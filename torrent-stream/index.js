var request = require('request');
var MongoClient = require('mongodb').MongoClient;

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = (event, context) => {
  try {
    console.log(`event.session.application.applicationId=${event.session.application.applicationId}`);

    /**
     * Uncomment this if statement and populate with your skill's application ID to
     * prevent someone else from configuring a skill that sends requests to this function.
     */
    /*
    if (event.session.application.applicationId !== 'amzn1.echo-sdk-ams.app.[unique-value-here]') {
         context.fail('Invalid Application ID');
    }
    */

    if (event.session.new) {
      onSessionStarted({requestId: event.request.requestId}, event.session);
    }

    if (event.request.type === 'LaunchRequest') {
      onLaunch(event.request,
        event.session,
        function callback (sessionAttributes, speechletResponse) {
          context.succeed(buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === 'IntentRequest') {
      onIntent(event.request,
        event.session,
        function callback (sessionAttributes, speechletResponse) {
          context.succeed(buildResponse(sessionAttributes, speechletResponse));
        });
    } else if (event.request.type === 'SessionEndedRequest') {
      onSessionEnded(event.request, event.session);
      context.succeed();
    }
  } catch (e) {
    context.fail(`Exception: ${e}`);
  }
};

/**
 * Called when the session starts.
 */
function onSessionStarted (sessionStartedRequest, session) {
  console.log(`onSessionStarted requestId=${sessionStartedRequest.requestId}, sessionId=${session.sessionId}`);
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch (launchRequest, session, callback) {
  console.log(`onLaunch requestId=${launchRequest.requestId}, sessionId=${session.sessionId}`);

  // Dispatch to your skill's launch.
  getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent (intentRequest, session, callback) {
  var intent = intentRequest.intent;
  var intentName = intentRequest.intent.name;

  console.log(`onIntent requestId=${intentRequest.requestId}, sessionId=${session.sessionId}`);

  // Dispatch to your skill's intent handlers
  if ('mediaSearchQuery' === intentName) {
    getMedia(intent, session, callback);
  } else if ('AMAZON.HelpIntent' === intentName) {
    getWelcomeResponse(callback);
  }
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded (sessionEndedRequest, session) {
  console.log(`onSessionEnded requestId=${sessionEndedRequest.requestId}, sessionId=${session.sessionId}`);
}

// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse (callback) {
  // If we wanted to initialize the session to have some attributes we could add those here.
  var sessionAttributes = {};
  var cardTitle = 'Welcome';
  var speechOutput = 'Welcome to the Torrent Stream app. ' +
    'Please ask me to stream a movie or TV show';
  // If the user either does not reply to the welcome message or says something that is not
  // understood, they will be prompted again with this text.
  var repromptText = 'Please ask me to stream a movie ot TV show';
  var shouldEndSession = true;

  callback(sessionAttributes,
    buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession));
}

function getMediaData (media, callback) {
  var url = `https://kat.cr/json.php?q=${media}&field=seeders&order=desc`;

  request(url, (error, response, body) => {
    if (!error && response.statusCode === 200) {
      callback(JSON.parse(body));
    } else {
      console.log(error, response.statusCode);
    }
  });
}

function getTrendResponse (trend, db, data) {
  var filteredOutput = data.list
    .filter(item => item.category === 'Movies' || item.category === 'TV')
    .map(item => ({
      title: item.title,
      category: item.category,
      seeds: item.seeds,
      magnet: `magnet:?xt=urn:btih:${item.hash}`
    })) || [];
  var topMatch = filteredOutput[0] || {};
  var title = topMatch.title;
  var seeds = topMatch.seeds;
  var torrent = topMatch.magnet;
  var insertDocument = (db, callback) => {
    db.collection('torrents').insertOne({torrent}, (err, result) => {
      console.log('Inserted into the torrents collection.');
      callback();
    });
  };

  insertDocument(db, () => db.close());
  return `The top search result for ${trend} is ${title}, with ${seeds} seeders`;
}

function getMedia (intent, session, callback) {
  var media = intent.slots.media.value;
  var cardTitle = `Search Results for ${media}`;
  var url = 'mongodb://master:PW@LOGIN.mlab.com:19980/heroku_cbmx7645';
  MongoClient.connect(url, (err, db) => {
    getMediaData(media, d => {
      callback({}, buildSpeechletResponse(cardTitle, getTrendResponse(media, db, d), 'No', true));
    });
  });
}

// --------------- Helpers that build all of the responses -----------------------
function buildSpeechletResponse (title, output, repromptText, shouldEndSession) {
  return {
    outputSpeech: {
      type: 'PlainText',
      text: output
    },
    card: {
      type: 'Simple',
      title: `Torrent Stream - ${title}`,
      content: `Top result - ${output}`
    },
    reprompt: {
      outputSpeech: {
        type: 'PlainText',
        text: repromptText
      }
    },
    shouldEndSession
  };
}

function buildResponse (sessionAttributes, response) {
  return {
    version: '1.0',
    sessionAttributes,
    response
  };
}
