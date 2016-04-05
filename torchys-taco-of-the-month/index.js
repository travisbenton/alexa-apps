var cheerio = require('cheerio');
var request = require('request');

// Route the incoming request based on type (LaunchRequest, IntentRequest,
// etc.) The JSON body of the request is provided in the event parameter.
exports.handler = function (event, context) {
  try {
	  console.log("event.session.application.applicationId=" + event.session.application.applicationId);
	  if (event.session.new) {
      onSessionStarted({requestId: event.request.requestId}, event.session);
	  }

	  if (event.request.type === "LaunchRequest") {
      onLaunch(event.request,
	      event.session,
	      function callback(sessionAttributes, speechletResponse) {
          context.succeed(buildResponse(sessionAttributes, speechletResponse));
	      });
	  } else if (event.request.type === "IntentRequest") {
      onIntent(event.request,
	      event.session,
	      function callback(sessionAttributes, speechletResponse) {
          context.succeed(buildResponse(sessionAttributes, speechletResponse));
	      });
	  } else if (event.request.type === "SessionEndedRequest") {
      onSessionEnded(event.request, event.session);
      context.succeed();
	  }
  } catch (e) {
    context.fail("Exception: " + e);
  }
};

/**
 * Called when the session starts.
 */
function onSessionStarted(sessionStartedRequest, session) {
    console.log("onSessionStarted requestId=" + sessionStartedRequest.requestId +
        ", sessionId=" + session.sessionId);
}

/**
 * Called when the user ends the session.
 * Is not called when the skill returns shouldEndSession=true.
 */
function onSessionEnded(sessionEndedRequest, session) {
    console.log("onSessionEnded requestId=" + sessionEndedRequest.requestId +
        ", sessionId=" + session.sessionId);
    // Add cleanup logic here
}

/**
 * Called when the user launches the skill without specifying what they want.
 */
function onLaunch(launchRequest, session, callback) {
    console.log("onLaunch requestId=" + launchRequest.requestId +
        ", sessionId=" + session.sessionId);

    // Dispatch to your skill's launch.
    getWelcomeResponse(callback);
}

/**
 * Called when the user specifies an intent for this skill.
 */
function onIntent(intentRequest, session, callback) {
    console.log("onIntent requestId=" + intentRequest.requestId +
        ", sessionId=" + session.sessionId);

    var intent = intentRequest.intent;
    var intentName = intentRequest.intent.name;

    // Dispatch to your skill's intent handlers
    torchysIntent(intent, session, callback);
}


// --------------- Functions that control the skill's behavior -----------------------

function getWelcomeResponse(callback) {
    // // If we wanted to initialize the session to have some attributes we could add those here.
    // var sessionAttributes = {};
    // var cardTitle = "Welcome";
    // var speechOutput = "Welcome to the if app. Ask if DMX is in jail.";
    // // If the user either does not reply to the welcome message or says something that is not
    // // understood, they will be prompted again with this text.
    // var repromptText = "Don't you want to know if DMX is in jail?";
    // var shouldEndSession = true;

    // callback(sessionAttributes,
    //   buildSpeechletResponse(cardTitle, speechOutput, repromptText, shouldEndSession)
    // );
}

function torchysIntent (intent, session, callback) {
	request('http://torchystacos.com/menu/', function (error, response, body) {
	  if (!error && response.statusCode == 200) {
	    var $ = cheerio.load(body);
	    var $totm = $('#taco-of-the-month').find('.single-menu-item').not('#empty');
	    var name = $totm.find('h1').text();
	    var description = $totm.find('p').text().toLowerCase();
	    var response = 'Taco of the Month is ' + name + '. The ingredients are ' + description;
	    var cardTitle = 'Torchys Taco of the Month'

	    callback({}, buildSpeechletResponse(cardTitle, response, "No", true));
	  }
	});
}

function buildSpeechletResponse(title, output, repromptText, shouldEndSession) {
  return {
	  outputSpeech: {
      type: "PlainText",
      text: output
	  },
	  card: {
      type: "Simple",
      title: title,
      content: output
	  },
	  reprompt: {
      outputSpeech: {
        type: "PlainText",
        text: repromptText
      }
	  },
	  shouldEndSession: shouldEndSession
  };
}

function buildResponse(sessionAttributes, speechletResponse) {
  return {
    version: "1.0",
    sessionAttributes: sessionAttributes,
    response: speechletResponse
  };
}