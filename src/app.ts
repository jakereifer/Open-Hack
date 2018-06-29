import { BotFrameworkAdapter, MemoryStorage, UserState, ConversationState, TurnContext } from 'botbuilder';
import * as restify from 'restify';
import { STATUS_CODES } from 'http';
import { Context, isContext } from 'vm';
const { MessageFactory } = require('botbuilder');
require('es6-promise').polyfill();
require('isomorphic-fetch');
var azure = require('azure-storage');
const botbuilder_dialogs = require('botbuilder-dialogs');
import { DialogSet } from 'botbuilder-dialogs';
const {CardFactory} = require('botbuilder');
var AzureSearch = require('azure-search');
var dia = require("./dialogs");
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
tableSvc.createTableIfNotExists('mytable', function (error, result, response) {
    if (!error) {
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

function addFAQ(q: string, a: string, gr: boolean) {
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
    })
}
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
const qnaURL: string = "https://openhackqnamaker.azurewebsites.net/qnamaker/knowledgebases/df82db7b-3e22-4d25-9e27-9055d64b6b8c/generateAnswer";

async function processQuestion(q: string): Promise<string> {
    var person: string = await fetch(qnaURL, {
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
}

const questionURL = 'https://openhackqnamaker-asbj2jawqzgtejk.search.windows.net/indexes/my-target-index/docs?api-version=2016-09-01&search=Milk';

interface SearchAnswer {
    "@odata.context": string;
    value: Band[];
}
interface Band {
    "@search.score": string,
    "eventId": string,
    "bandName":string,
    "genre": string,
    "imageUrl": string,
    "description":string,
    "stage": string,
    "startTime": string,
    "endTime": string,
    "day":string,
    "date": string
}

async function bandSearch(): Promise<SearchAnswer> {
    var person: SearchAnswer = await fetch(questionURL, {
        method: 'GET',
        headers: {
            'api-key': "D4BD28224DB0862A9819C003C5D90F5B"
        },
        body:'',
    })
        .then(function (response) {
            return response.json();
        })
    return Promise.resolve(person);
}






// Listen for incoming requests 
server.post('/api/messages', (req, res) => {
    // Route received request to adapter for processing
    adapter.processActivity(req, res, async (context) => {
        const state = conversationState.get(context);
        const dc = dialogs.createContext(context, state);
        if (isWelcome(context)) {
            state.menuFlag = true;
            await context.sendActivity(welcomeMessage);
            var searchResult = await bandSearch();
            console.log(searchResult.value);
            await context.sendActivity(searchResult.value[0].bandName);
            await dc.begin('MainMenuDialog');
        }
        if (!context.responded) {
            await dc.continue();
        }
    });
});









































//Dialogs
const dialogs = new DialogSet();
dialogs.add('FAQDialog', [
    async function (dc) {
        await dc.prompt('textPrompt', "Ask me questions about the festival and I'll do my best to answer!");
    },
    async function (dc, results) {
        var state = conversationState.get(dc.context);
        state.questionText = results;
        var answer = await processQuestion(results);
        state.answerText = answer;
        await dc.context.sendActivity(answer);
        await dc.prompt('choicePrompt', 'Was this the answer you are looking for?', ['Yes', 'No'], { retryPrompt: 'Was this the answer you are looking for?' });
    },
    async function (dc, results) {
        var state = conversationState.get(dc.context);
        if (results.value === 'Yes') {
            state.correctAnswer = true;
            await dc.context.sendActivity("Great! I'll make a note that this is the right answer to your question!");
        }
        else {
            state.correctAnswer = false;
            await dc.context.sendActivity("Sorry to hear that! I'll use your feedback to better answer your questions in the future!");
        }
        addFAQ(state.questionText, state.answerText, state.correctAnswer);
        await dc.end();
        await dc.begin('MainMenuDialog');
    }
]);

dialogs.add('MainMenuDialog', [
    async function (dc) {
        await dc.context.sendActivity(questionMessage);
    },
    async function (dc, results) {
        if (dc.context.activity.type === 'message' && responseCheck(dc.context.activity.text)) {
            if (results === 'FAQs') {
                await dc.end();
                await dc.begin('FAQDialog');
            }
            else if (results === 'Band Search') {
                await dc.end();
                await dc.begin('BSDialog');    
            }

        }
    }
]);

dialogs.add('BSDialog', [
    async function (dc) {
        await dc.prompt('textPrompt', "What band would you like to search for?");
    },
    async function (dc, results) {
        //Search and find the count to post plural response
        
        
        await dc.end();
        await dc.begin('MainMenuDialog');
    }
]);


dialogs.add('textPrompt', new botbuilder_dialogs.TextPrompt());
dialogs.add('choicePrompt', new botbuilder_dialogs.ChoicePrompt());