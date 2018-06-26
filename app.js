"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const botbuilder_1 = require("botbuilder");
const restify = require("restify");
const { MessageFactory } = require('botbuilder');
require('es6-promise').polyfill();
require('isomorphic-fetch');
// Create server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`${server.name} listening to ${server.url}`);
});
// Create adapter
const adapter = new botbuilder_1.BotFrameworkAdapter({
//appId: "34a301f2-dd02-4c1d-ad38-e4f81d5354e0",
//appPassword: "avpUW952=?:-ffhqZJZKA92"
});
// Add state middleware
const storage = new botbuilder_1.MemoryStorage();
const convoState = new botbuilder_1.ConversationState(storage);
const userState = new botbuilder_1.UserState(storage);
// Add conversation state middleware
const conversationState = new botbuilder_1.ConversationState(new botbuilder_1.MemoryStorage());
adapter.use(conversationState);
function isWelcome(context) {
    if (context.activity.type === 'conversationUpdate' && context.activity.membersAdded[0].name !== 'Bot') {
        return true;
    }
    return false;
}
function responseCheck(text) {
    switch (text) {
        case 'FAQs':
            return true;
        case 'Band Search':
            return true;
        case 'Navigate':
            return true;
        default:
            return false;
    }
}
function refreshBot(state) {
    state.questionText = '';
    state.correctAnswer = false;
    state.menuFlag = false;
    state.FAQFlag = false;
    state.questionFlag = false;
    state.answerFlag = false;
}
const questionMessage = MessageFactory.suggestedActions(['FAQs', 'Band Search', 'Navigate'], 'How would you like to explore the event?');
const welcomeMessage = "Hey there! I'm the ASH Music Festival Bot. I'm here to guide you around the festival!";
const confirmMessage = MessageFactory.suggestedActions(['Yes', 'No'], 'Was this the answer you were looking for?');
const qnaURL = "https://openhackqnamaker.azurewebsites.net/qnamaker/knowledgebases/df82db7b-3e22-4d25-9e27-9055d64b6b8c/generateAnswer";
function processQuestion(q) {
    return __awaiter(this, void 0, void 0, function* () {
        var person = yield fetch(qnaURL, {
            method: 'POST',
            headers: {
                'Content-type': 'application/json',
                'Authorization': 'EndpointKey 3dab1dab-73ae-498e-b2de-dd7126b42207'
            },
            body: JSON.stringify({ 'question': `${q}` }),
        })
            .then(function (response) {
            return response.json();
        })
            .then(function (response) {
            return response.answers[0].answer;
        });
        return Promise.resolve(person);
    });
}
// Listen for incoming requests 
server.post('/api/messages', (req, res) => {
    // Route received request to adapter for processing
    adapter.processActivity(req, res, (context) => __awaiter(this, void 0, void 0, function* () {
        const state = conversationState.get(context);
        /*
        POST /knowledgebases/df82db7b-3e22-4d25-9e27-9055d64b6b8c/generateAnswer
        Host: https://openhackqnamaker.azurewebsites.net/qnamaker
        Authorization: EndpointKey 3dab1dab-73ae-498e-b2de-dd7126b42207
        Content-Type: application/json
        {"question":"When is the festival"}
        */
        if (isWelcome(context)) {
            state.menuFlag = true;
        }
        if (state.menuFlag) {
            yield context.sendActivity(welcomeMessage);
            yield context.sendActivity(questionMessage);
            state.menuFlag = false;
        }
        else if (state.FAQFlag) { //
            if (state.questionFlag) {
                state.questionText = context.activity.text;
                //send question and receive answer
                var a = yield processQuestion(state.questionText);
                yield context.sendActivity(a);
                yield context.sendActivity(confirmMessage);
                state.answerFlag = true;
                state.questionFlag = false;
            }
            else if (state.answerFlag) {
                var confirmation = context.activity.text;
                if (confirmation === 'Yes') {
                    yield context.sendActivity("Great! I'll make a note that this is the right answer to your question");
                    //store
                }
                else {
                    yield context.sendActivity("Sorry to hear that! I'll yse your feedback to better answer your questions in the future!");
                    //store
                }
                refreshBot(state);
                yield context.sendActivity(questionMessage);
            }
        }
        else if (context.activity.type === 'message' && responseCheck(context.activity.text)) {
            if (context.activity.text === 'FAQs') {
                yield context.sendActivity("Ask me questions about the festival and I'll do my best to answer!");
                state.FAQFlag = true;
                state.questionFlag = true;
            }
        }
    }));
});
