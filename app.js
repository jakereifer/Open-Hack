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
// Create server
let server = restify.createServer();
server.listen(process.env.port || process.env.PORT || 3978, function () {
    console.log(`${server.name} listening to ${server.url}`);
});
// Create adapter
const adapter = new botbuilder_1.BotFrameworkAdapter({
    appId: process.env.MICROSOFT_APP_ID,
    appPassword: process.env.MICROSOFT_APP_PASSWORD
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
const questionMessage = MessageFactory.suggestedActions(['FAQs', 'Band Search', 'Navigate'], 'How would you like to explore the event?');
const welcomeMessage = "Hey there! I'm the ASH Music Festival Bot. I'm here to guide you around the festival!";
// Listen for incoming requests 
server.post('/api/messages', (req, res) => {
    // Route received request to adapter for processing
    adapter.processActivity(req, res, (context) => __awaiter(this, void 0, void 0, function* () {
        const state = conversationState.get(context);
        if (isWelcome(context)) {
            yield context.sendActivity(welcomeMessage);
            yield context.sendActivity(questionMessage);
        }
        if (context.activity.type === 'message' && responseCheck(context.activity.text)) {
            yield context.sendActivity(`You clicked the ${context.activity.text} button!`);
        }
    }));
});
