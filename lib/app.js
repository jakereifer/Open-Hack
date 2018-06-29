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
var azure = require('azure-storage');
const botbuilder_dialogs = require('botbuilder-dialogs');
const botbuilder_dialogs_1 = require("botbuilder-dialogs");
const { CardFactory } = require('botbuilder');
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
var tableSvc = azure.createTableService('openhack3', 'GAhqDdVI1y2Ezaf6qB+318sGC3TnUn0o8foTjaCwzeEKK+HdscY8nVO9qDfO+cwu5TeqsMQlrk/DjIyFDa5toQ==');
tableSvc.createTableIfNotExists('mytable', function (error, result, response) {
    if (!error) {
        console.log('Successfully added or found table!');
    }
});
var entGen = azure.TableUtilities.entityGenerator;
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
    state.answerText = '';
    state.correctAnswer = false;
    state.menuFlag = false;
    state.FAQFlag = false;
    state.questionFlag = false;
    state.answerFlag = false;
}
const questionMessage = MessageFactory.suggestedActions(['FAQs', 'Band Search', 'Navigate'], 'How would you like to explore the event?');
const welcomeMessage = "Hey there! I'm the ASH Music Festival Bot. I'm here to guide you around the festival!";
const confirmMessage = MessageFactory.suggestedActions(['Yes', 'No'], 'Was this the answer you were looking for?');
function addFAQ(q, a, gr) {
    var storageEntity = {
        PartitionKey: { '_': 'FAQs' },
        RowKey: { '_': Date.now().toString() },
        question: { '_': `${q}` },
        answer: { '_': `${a}` },
        goodResponse: { '_': `${gr}`, '$': 'Edm.Boolean' },
    };
    tableSvc.insertEntity('mytable', storageEntity, function (error, result, response) {
        if (!error) {
            console.log("successfully added");
        }
    });
}
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
/*
POST /knowledgebases/df82db7b-3e22-4d25-9e27-9055d64b6b8c/generateAnswer
Host: https://openhackqnamaker.azurewebsites.net/qnamaker
Authorization: EndpointKey 3dab1dab-73ae-498e-b2de-dd7126b42207
Content-Type: application/json
{"question":"When is the festival"}
*/
// Listen for incoming requests 
server.post('/api/messages', (req, res) => {
    // Route received request to adapter for processing
    adapter.processActivity(req, res, (context) => __awaiter(this, void 0, void 0, function* () {
        const state = conversationState.get(context);
        const dc = dialogs.createContext(context, state);
        if (isWelcome(context)) {
            state.menuFlag = true;
            yield context.sendActivity(welcomeMessage);
            yield dc.begin('MainMenuDialog');
        }
        if (!context.responded) {
            yield dc.continue();
        }
    }));
});
//Dialogs
const dialogs = new botbuilder_dialogs_1.DialogSet();
dialogs.add('FAQDialog', [
    function (dc) {
        return __awaiter(this, void 0, void 0, function* () {
            yield dc.prompt('textPrompt', "Ask me questions about the festival and I'll do my best to answer!");
        });
    },
    function (dc, results) {
        return __awaiter(this, void 0, void 0, function* () {
            var state = conversationState.get(dc.context);
            state.questionText = results;
            var answer = yield processQuestion(results);
            state.answerText = answer;
            yield dc.context.sendActivity(answer);
            yield dc.prompt('choicePrompt', 'Was this the answer you are looking for?', ['Yes', 'No'], { retryPrompt: 'Was this the answer you are looking for?' });
        });
    },
    function (dc, results) {
        return __awaiter(this, void 0, void 0, function* () {
            var state = conversationState.get(dc.context);
            if (results.value === 'Yes') {
                state.correctAnswer = true;
                yield dc.context.sendActivity("Great! I'll make a note that this is the right answer to your question!");
            }
            else {
                state.correctAnswer = false;
                yield dc.context.sendActivity("Sorry to hear that! I'll use your feedback to better answer your questions in the future!");
            }
            addFAQ(state.questionText, state.answerText, state.correctAnswer);
            yield dc.end();
            yield dc.begin('MainMenuDialog');
        });
    }
]);
dialogs.add('MainMenuDialog', [
    function (dc) {
        return __awaiter(this, void 0, void 0, function* () {
            yield dc.context.sendActivity(questionMessage);
        });
    },
    function (dc, results) {
        return __awaiter(this, void 0, void 0, function* () {
            if (dc.context.activity.type === 'message' && responseCheck(dc.context.activity.text)) {
                if (results === 'FAQs') {
                    yield dc.end();
                    yield dc.begin('FAQDialog');
                }
                else if (results === 'Band Search') {
                    yield dc.end();
                    yield dc.begin('BSDialog');
                }
            }
        });
    }
]);
dialogs.add('BSDialog', [
    function (dc) {
        return __awaiter(this, void 0, void 0, function* () {
            yield dc.prompt('textPrompt', "What band would you like to search for?");
        });
    },
    function (dc, results) {
        return __awaiter(this, void 0, void 0, function* () {
            //Search and find the count to post plural response
            yield dc.end();
            yield dc.begin('MainMenuDialog');
        });
    }
]);
dialogs.add('textPrompt', new botbuilder_dialogs.TextPrompt());
dialogs.add('choicePrompt', new botbuilder_dialogs.ChoicePrompt());
//# sourceMappingURL=app.js.map