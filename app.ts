import { BotFrameworkAdapter, MemoryStorage, UserState, ConversationState, TurnContext } from 'botbuilder';
import * as restify from 'restify';
import { STATUS_CODES } from 'http';
const { MessageFactory } = require('botbuilder');

// Create server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`${server.name} listening to ${server.url}`);
});

// Create adapter
const adapter = new BotFrameworkAdapter({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
});

// Define conversation state shape
interface C1State {
    count: number;
}

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
const questionMessage = MessageFactory.suggestedActions(['FAQs', 'Band Search', 'Navigate'], 'How would you like to explore the event?');
const welcomeMessage = "Hey there! I'm the ASH Music Festival Bot. I'm here to guide you around the festival!";

// Listen for incoming requests 
server.post('/api/messages', (req, res) => {
    // Route received request to adapter for processing
    adapter.processActivity(req, res, async (context) => {
        const state = conversationState.get(context);
        if (isWelcome(context)) {
            await context.sendActivity(welcomeMessage);
            await context.sendActivity(questionMessage);
        }
        if (context.activity.type === 'message' && responseCheck(context.activity.text)) {
            await context.sendActivity(`You clicked the ${context.activity.text} button!`)
        }
    });
});