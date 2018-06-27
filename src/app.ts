import { BotFrameworkAdapter, MemoryStorage, UserState, ConversationState, TurnContext } from 'botbuilder';
import * as restify from 'restify';
import { STATUS_CODES } from 'http';
import { Context } from 'vm';
const { MessageFactory } = require('botbuilder');
require('es6-promise').polyfill();
require('isomorphic-fetch');
var azure = require('azure-storage');
const botbuilder_dialogs = require('botbuilder-dialogs');

// Create server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`${server.name} listening to ${server.url}`);
});

// Create adapter
const adapter = new BotFrameworkAdapter({
    //appId: "34a301f2-dd02-4c1d-ad38-e4f81d5354e0",
    //appPassword: "avpUW952=?:-ffhqZJZKA92"
});

// Add state middleware
const storage = new MemoryStorage();
const convoState = new ConversationState(storage);
const userState = new UserState(storage);

// Add conversation state middleware
const conversationState = new ConversationState<C1State>(new MemoryStorage());
adapter.use(conversationState);

var tableSvc = azure.createTableService('openhack3', 'GAhqDdVI1y2Ezaf6qB+318sGC3TnUn0o8foTjaCwzeEKK+HdscY8nVO9qDfO+cwu5TeqsMQlrk/DjIyFDa5toQ==');
tableSvc.createTableIfNotExists('mytable', function(error, result, response){
    if(!error){
        console.log('Successfully added or found table!');
    }
});
var entGen = azure.TableUtilities.entityGenerator;

function isWelcome(context: TurnContext): boolean {
    if (context.activity.type === 'conversationUpdate' && context.activity.membersAdded[0].name !== 'Bot') {
        return true;
    }
    return false;
}


function responseCheck(text: string): boolean {
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

function refreshBot(state: C1State): void {
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
const confirmMessage = MessageFactory.suggestedActions(['Yes', 'No'], 'Was this the answer you were looking for?')


// Define conversation state shape
interface C1State {
    count: number;
    questionText: string;
    answerText: string;
    correctAnswer: boolean;
    //flags
    menuFlag: boolean;
    FAQFlag: boolean;
    questionFlag: boolean;
    answerFlag: boolean;
}
const qnaURL : string = "https://openhackqnamaker.azurewebsites.net/qnamaker/knowledgebases/df82db7b-3e22-4d25-9e27-9055d64b6b8c/generateAnswer";

async function processQuestion(q: string) : Promise<string> {
    var person : string = await fetch(qnaURL, {
        method: 'POST',
        headers: {
            'Content-type': 'application/json',
            'Authorization': 'EndpointKey 3dab1dab-73ae-498e-b2de-dd7126b42207'
        },
        body: JSON.stringify({'question':`${q}`}),
    })
    .then(function (response) {
        return response.json();
    })
    .then(function (response) {
        return response.answers[0].answer;
    });
    return Promise.resolve(person);
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
    adapter.processActivity(req, res, async (context) => {
        const state = conversationState.get(context);
        if (isWelcome(context)) {
            state.menuFlag = true;
        }
        if (state.menuFlag) {
            await context.sendActivity(welcomeMessage);
            await context.sendActivity(questionMessage);
            state.menuFlag = false;
        }
        else if (state.FAQFlag) {//
            if (state.questionFlag) {
                state.questionText = context.activity.text;
                //send question and receive answer
                var a : string = await processQuestion(state.questionText);
                state.answerText = a;
                await context.sendActivity(a);
                await context.sendActivity(confirmMessage);
                state.answerFlag = true;
                state.questionFlag = false;
            }
            else if (state.answerFlag) {
                var confirmation : string = context.activity.text;
                var confirmationBool : boolean;
                if (confirmation === 'Yes') {
                    await context.sendActivity("Great! I'll make a note that this is the right answer to your question");
                    confirmationBool = true;
                } 
                else {
                    await context.sendActivity("Sorry to hear that! I'll yse your feedback to better answer your questions in the future!");
                    confirmationBool = false;
                }
                var storageEntity = {
                    PartitionKey: {'_':'FAQs'},
                    RowKey: {'_': Date.now().toString()},
                    question: {'_':`${state.questionText}`},
                    answer: {'_':`${state.answerText}`},
                    goodResponse: {'_':`${confirmationBool}`, '$':'Edm.Boolean'},
                };
                tableSvc.insertEntity('mytable', storageEntity, function (error, result, response) {
                    if(!error) {
                        console.log("successfully added");
                    }
                })
                refreshBot(state);
                await context.sendActivity(questionMessage);             
            }
        }
        else if (context.activity.type === 'message' && responseCheck(context.activity.text)) {
            if (context.activity.text === 'FAQs') {
                await context.sendActivity("Ask me questions about the festival and I'll do my best to answer!");
                state.FAQFlag = true;
                state.questionFlag = true;
            }
        }
    });
});