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
var AzureSearch = require('azure-search');
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
    state.currentBands = [];
    state.navDay = '';
    state.navGenre = '';
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
const questionURL = 'https://openhackqnamaker-asbj2jawqzgtejk.search.windows.net/indexes/my-target-index/docs?api-version=2016-09-01&search=';
//filter=day%20eq%20'Sunday'%20and%20genre%20eq%20'Rock'
function navSearch(day, genre) {
    return __awaiter(this, void 0, void 0, function* () {
        var suffix;
        if (day === 'Any' && genre === 'Any') {
            suffix = '';
        }
        else if (day === 'Any') {
            suffix = `&%24filter=genre%20eq%20'${genre}'`;
        }
        else if (genre === 'Any') {
            suffix = `&%24filter=day%20eq%20'${day}'`;
        }
        else {
            suffix = `&%24filter=day%20eq%20'${day}'%20and%20genre%20eq%20'${genre}'`;
        }
        var navSearchURL = `https://openhackqnamaker-asbj2jawqzgtejk.search.windows.net/indexes/my-target-index/docs?api-version=2016-09-01&search=&%24`;
        var bandlist = yield fetch(navSearchURL + suffix, {
            method: 'GET',
            headers: {
                'api-key': "D4BD28224DB0862A9819C003C5D90F5B"
            },
            body: '',
        })
            .then(function (response) {
            return response.json();
        });
        return Promise.resolve(bandlist.value);
    });
}
function bandSearch(band) {
    return __awaiter(this, void 0, void 0, function* () {
        var bandlist = yield fetch(questionURL + band /*+'~&queryType=full&facet=day'*/, {
            method: 'GET',
            headers: {
                'api-key': "D4BD28224DB0862A9819C003C5D90F5B"
            },
            body: '',
        })
            .then(function (response) {
            return response.json();
        });
        return Promise.resolve(bandlist.value);
    });
}
function findPictureURL(img) {
    return 'https://ashbotnodev49e75.blob.core.windows.net/band-pics/' + img.substring(9);
}
function daySearch() {
    return __awaiter(this, void 0, void 0, function* () {
        var SA = yield fetch(questionURL + '*&facet=day', {
            method: 'GET',
            headers: {
                'api-key': "D4BD28224DB0862A9819C003C5D90F5B"
            },
            body: '',
        })
            .then(function (response) {
            return response.json();
        });
        return Promise.resolve(SA["@search.facets"]);
    });
}
function genreSearch() {
    return __awaiter(this, void 0, void 0, function* () {
        var SA = yield fetch(questionURL + '*&facet=genre', {
            method: 'GET',
            headers: {
                'api-key': "D4BD28224DB0862A9819C003C5D90F5B"
            },
            body: '',
        })
            .then(function (response) {
            return response.json();
        });
        return Promise.resolve(SA["@search.facets"]);
    });
}
// Listen for incoming requests 
server.post('/api/messages', (req, res) => {
    // Route received request to adapter for processing
    adapter.processActivity(req, res, (context) => __awaiter(this, void 0, void 0, function* () {
        const state = conversationState.get(context);
        const dc = dialogs.createContext(context, state);
        if (isWelcome(context)) {
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
            refreshBot(state);
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
                else if (results === 'Navigate') {
                    yield dc.end();
                    yield dc.begin('NavDialog');
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
            var searchResult = yield bandSearch(results);
            var state = conversationState.get(dc.context);
            state.currentBands = searchResult;
            if (searchResult.length === 1) {
                yield dc.context.sendActivity("Here is the show you are looking for!");
                const message = MessageFactory.attachment(CardFactory.heroCard(searchResult[0].bandName, `${searchResult[0].day}, ${searchResult[0].startTime} at the ${searchResult[0].stage} Stage`, [yield findPictureURL(searchResult[0].imageUrl)], [{
                        type: botbuilder_1.ActionTypes.ImBack,
                        title: 'Description',
                        value: 'Description'
                    },
                    {
                        type: botbuilder_1.ActionTypes.ImBack,
                        title: 'Back to Main Menu',
                        value: "Back to Main Menu"
                    }]));
                yield dc.context.sendActivity(message);
            }
            else if (searchResult.length > 1) {
                yield dc.context.sendActivity("Here are the shows you are looking for!");
                var l = searchResult.length;
                var list = [];
                for (var i = 0; i < l; i++) {
                    list[i] = CardFactory.heroCard(searchResult[i].bandName, `${searchResult[i].day}, ${searchResult[i].startTime} at the ${searchResult[i].stage} Stage`, [yield findPictureURL(searchResult[i].imageUrl)], [{
                            type: botbuilder_1.ActionTypes.PostBack,
                            title: 'Description',
                            value: `${i}: Description`,
                        },
                        {
                            type: botbuilder_1.ActionTypes.ImBack,
                            title: 'Back to Main Menu',
                            value: 'Back to Main Menu'
                        }]);
                }
                //caroussel
                yield dc.context.sendActivity(MessageFactory.carousel(list));
            }
            else {
                yield dc.context.sendActivity("There is no band by that title!");
                refreshBot(state);
                dc.end();
                dc.begin("MainMenuDialog");
            }
        });
    },
    function (dc, result) {
        return __awaiter(this, void 0, void 0, function* () {
            var state = conversationState.get(dc.context);
            if (result === 'Back to Main Menu') {
                refreshBot(state);
                yield dc.end();
                yield dc.begin('MainMenuDialog');
            }
            else if (result === 'Description') {
                yield dc.context.sendActivity(state.currentBands[0].description);
                state.currentBands = [];
                yield dc.end();
                yield dc.begin('MainMenuDialog');
            }
            else {
                var first = result[0];
                yield dc.context.sendActivity(state.currentBands[first].description);
                refreshBot(state);
                yield dc.end();
                yield dc.begin('MainMenuDialog');
            }
        });
    }
]);
dialogs.add('NavDialog', [
    function (dc) {
        return __awaiter(this, void 0, void 0, function* () {
            var facetResults = yield daySearch();
            var days = facetResults.day;
            var list = [];
            for (var i = 0; i < days.length; i++) {
                list[i] = days[i].value;
            }
            list[list.length] = 'Any';
            const dayMessage = MessageFactory.suggestedActions(list, 'What day would you like to see music?');
            yield dc.context.sendActivity(dayMessage);
        });
    },
    function (dc, response) {
        return __awaiter(this, void 0, void 0, function* () {
            var state = conversationState.get(dc.context);
            //await dc.context.sendActivity(`You said ${response}`);
            state.navDay = response;
            var facetResults = yield genreSearch();
            var genres = facetResults.genre;
            var list = [];
            for (var i = 0; i < genres.length; i++) {
                list[i] = genres[i].value;
            }
            list[list.length] = 'Any';
            var dayQuestion;
            if (state.navDay === 'Any') {
                dayQuestion = 'What genre of music would you like to see?';
            }
            else {
                dayQuestion = `What genre of music would you like to see on ${state.navDay}?`;
            }
            const genreMessage = MessageFactory.suggestedActions(list, dayQuestion);
            yield dc.context.sendActivity(genreMessage);
        });
    },
    function (dc, result) {
        return __awaiter(this, void 0, void 0, function* () {
            var state = conversationState.get(dc.context);
            state.navGenre = result;
            //Search and find the count to post plural response
            var searchResult = yield navSearch(state.navDay, state.navGenre);
            var state = conversationState.get(dc.context);
            state.currentBands = searchResult;
            //Create message
            var pluralShow = searchResult.length > 1 ? 'shows' : 'show';
            var pluralIs = searchResult.length > 1 ? 'are' : 'is';
            var totalMessage;
            if (state.navDay === 'Any' && state.navGenre === 'Any') {
                totalMessage = `Here ${pluralIs} the ${pluralShow}!`;
            }
            else if (state.navDay === 'Any') {
                totalMessage = `Here ${pluralIs} ${state.navGenre} the ${pluralShow}!`;
            }
            else if (state.navGenre === 'Any') {
                totalMessage = `Here ${pluralIs} the ${pluralShow} on ${state.navDay}!`;
            }
            else {
                totalMessage = `Here ${pluralIs} the ${state.navGenre} ${pluralShow} on ${state.navDay}!`;
            }
            if (searchResult.length >= 1) {
                yield dc.context.sendActivity(totalMessage);
                var l = searchResult.length;
                var list = [];
                for (var i = 0; i < l; i++) {
                    list[i] = CardFactory.heroCard(searchResult[i].bandName, `${searchResult[i].day}, ${searchResult[i].startTime} at the ${searchResult[i].stage} Stage`, [yield findPictureURL(searchResult[i].imageUrl)], [{
                            type: botbuilder_1.ActionTypes.PostBack,
                            title: 'Description',
                            value: `${i}: Description`,
                        },
                        {
                            type: botbuilder_1.ActionTypes.ImBack,
                            title: 'Back to Main Menu',
                            value: 'Back to Main Menu'
                        }]);
                }
                //caroussel
                yield dc.context.sendActivity(MessageFactory.carousel(list));
            }
            else {
                yield dc.context.sendActivity("There is no bands with that genre on that day!");
                state.currentBands = [];
                refreshBot(state);
                dc.end();
                dc.begin("MainMenuDialog");
            }
        });
    },
    function (dc, result) {
        return __awaiter(this, void 0, void 0, function* () {
            var state = conversationState.get(dc.context);
            if (result === 'Back to Main Menu') {
                yield dc.end();
                yield dc.begin('MainMenuDialog');
            }
            else {
                var first = result[0];
                yield dc.context.sendActivity(state.currentBands[first].description);
                state.currentBands = [];
                refreshBot(state);
                yield dc.end();
                yield dc.begin('MainMenuDialog');
            }
        });
    }
]);
dialogs.add('textPrompt', new botbuilder_dialogs.TextPrompt());
dialogs.add('choicePrompt', new botbuilder_dialogs.ChoicePrompt());
//# sourceMappingURL=app.js.map