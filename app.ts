import { BotFrameworkAdapter, MemoryStorage, UserState, ConversationState, TurnContext } from 'botbuilder';
import * as restify from 'restify';
import { STATUS_CODES } from 'http';
import { Context } from 'vm';
const { MessageFactory } = require('botbuilder');


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
    correctAnswer: boolean;
    
    menuFlag: boolean;
    FAQFlag: boolean;
    questionFlag: boolean;
    answerFlag: boolean;
}

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
                await context.sendActivity(`Answer`);
                await context.sendActivity(confirmMessage);
                state.answerFlag = true;
                state.questionFlag = false;
            }
            else if (state.answerFlag) {
                var confirmation : string = context.activity.text;
                if (confirmation === 'Yes') {
                    await context.sendActivity("Great! I'll make a note that this is the right answer to your question");
                    //store
                } 
                else {
                    await context.sendActivity("Sorry to hear that! I'll yse your feedback to better answer your questions in the future!");
                    //store
                }
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