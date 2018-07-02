import { BotFrameworkAdapter, MemoryStorage, UserState, ConversationState, TurnContext, ActionTypes } from 'botbuilder';
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
    state.currentBands = [];
    state.navDay = '';
    state.navGenre = '';
}

const questionMessage = MessageFactory.suggestedActions(['FAQs', 'Band Search', 'Navigate'], 'How would you like to explore the event?');
const welcomeMessage = "Hey there! I'm the ASH Music Festival Bot. I'm here to guide you around the festival!";
const confirmMessage = MessageFactory.suggestedActions(['Yes', 'No'], 'Was this the answer you were looking for?');


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
    currentBands: Band[];
    navDay: string;
    navGenre: string;
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

const questionURL = 'https://openhackqnamaker-asbj2jawqzgtejk.search.windows.net/indexes/my-target-index/docs?api-version=2016-09-01&search=';

interface SearchAnswer {
    "@odata.context": string;
    "@search.facets"?: DGFacets;
    value: Band[];
}
interface DGFacets {
    "day@data.type"?: string;
    "day"?: Facet[];
    "genre@data.type"?: string;
    "genre"?: Facet[];
}
interface Facet {
    'count': number;
    'value': string;
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

//filter=day%20eq%20'Sunday'%20and%20genre%20eq%20'Rock'
async function navSearch(day: string, genre: string): Promise<Band[]> {
    var suffix: string;
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
    var navSearchURL : string = `https://openhackqnamaker-asbj2jawqzgtejk.search.windows.net/indexes/my-target-index/docs?api-version=2016-09-01&search=&%24`
    var bandlist: SearchAnswer = await fetch(navSearchURL+suffix, {
        method: 'GET',
        headers: {
            'api-key': "D4BD28224DB0862A9819C003C5D90F5B"
        },
        body:'',
        })
        .then(function (response) {
            return response.json();
        });
    return Promise.resolve(bandlist.value);
}

async function bandSearch(band : string): Promise<Band[]> {
    var bandlist: SearchAnswer = await fetch(questionURL+band/*+'~&queryType=full&facet=day'*/, {
        method: 'GET',
        headers: {
            'api-key': "D4BD28224DB0862A9819C003C5D90F5B"
        },
        body:'',
        })
        .then(function (response) {
            return response.json();
        });
    return Promise.resolve(bandlist.value);
}

function findPictureURL(img : string) : string {
    return 'https://ashbotnodev49e75.blob.core.windows.net/band-pics/' + img.substring(9);
}

async function daySearch() : Promise<DGFacets> {
    var SA : SearchAnswer = await fetch(questionURL+'*&facet=day', {
            method: 'GET',
            headers: {
                'api-key': "D4BD28224DB0862A9819C003C5D90F5B"
            },
            body:'',
            })
            .then(function (response) {
                return response.json();
            });
    return Promise.resolve(SA["@search.facets"]);
}

async function genreSearch() : Promise<DGFacets> {
    var SA : SearchAnswer = await fetch(questionURL+'*&facet=genre', {
            method: 'GET',
            headers: {
                'api-key': "D4BD28224DB0862A9819C003C5D90F5B"
            },
            body:'',
            })
            .then(function (response) {
                return response.json();
            });
    return Promise.resolve(SA["@search.facets"]);
}
// Listen for incoming requests 
server.post('/api/messages', (req, res) => {
    // Route received request to adapter for processing
    adapter.processActivity(req, res, async (context) => {
        const state = conversationState.get(context);
        const dc = dialogs.createContext(context, state);
        if (isWelcome(context)) {
            await context.sendActivity(welcomeMessage);
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
        refreshBot(state);
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
            else if (results === 'Navigate') {
                await dc.end();
                await dc.begin('NavDialog');
            }
        }
    }
]);

dialogs.add('BSDialog', [
    async function (dc) {
        await dc.prompt('textPrompt', "What band would you like to search for?");
    },
    async function (dc, results :string ) {
        //Search and find the count to post plural response
        var searchResult : Band[] = await bandSearch(results);
        var state = conversationState.get(dc.context);
        state.currentBands = searchResult;
        if (searchResult.length === 1) {
            await dc.context.sendActivity("Here is the show you are looking for!")
            const message = MessageFactory.attachment(
                CardFactory.heroCard(
                    searchResult[0].bandName,
                    `${searchResult[0].day}, ${searchResult[0].startTime} at the ${searchResult[0].stage} Stage`,
                    [await findPictureURL(searchResult[0].imageUrl)],
                    [{
                        type: ActionTypes.ImBack,
                        title:'Description',
                        value: 'Description'
                    },
                    {
                        type: ActionTypes.ImBack,
                        title:'Back to Main Menu',
                        value: "Back to Main Menu"
                    }]
                )
            );
            await dc.context.sendActivity(message);
        }
        else if (searchResult.length > 1) {
            await dc.context.sendActivity("Here are the shows you are looking for!");
            var l : number = searchResult.length;
            var list = [];
            for (var i : number = 0; i < l; i++) {
                list[i] = CardFactory.heroCard(
                    searchResult[i].bandName,
                    `${searchResult[i].day}, ${searchResult[i].startTime} at the ${searchResult[i].stage} Stage`,
                    [await findPictureURL(searchResult[i].imageUrl)],
                    [{
                        type: ActionTypes.PostBack,
                        title: 'Description',
                        value: `${i}: Description`,
                    },
                    {
                        type: ActionTypes.ImBack,
                        title: 'Back to Main Menu',
                        value: 'Back to Main Menu' 
                    }]
                )
            }
            //caroussel
            await dc.context.sendActivity(MessageFactory.carousel(list));
        }
        else {
            await dc.context.sendActivity("There is no band by that title!");
            refreshBot(state);
            dc.end();
            dc.begin("MainMenuDialog")
        }
    },
    async function (dc, result) {
        var state = conversationState.get(dc.context);
        if (result === 'Back to Main Menu') {
            refreshBot(state);
            await dc.end();
            await dc.begin('MainMenuDialog');            
        }
        else if (result === 'Description') {
            await dc.context.sendActivity(state.currentBands[0].description);
            state.currentBands = [];
            await dc.end();
            await dc.begin('MainMenuDialog');
        }
        else {
            var first : string = result[0];
            await dc.context.sendActivity(state.currentBands[first].description);
            refreshBot(state);
            await dc.end();
            await dc.begin('MainMenuDialog');
        }        
    }
]);

dialogs.add('NavDialog', [
    async function(dc) {
        var facetResults : DGFacets = await daySearch();
        var days = facetResults.day;
        var list : string[] = [];
        for (var i = 0; i < days.length; i++) {
            list[i] = days[i].value;
        }
        list[list.length] = 'Any';
        const dayMessage = MessageFactory.suggestedActions(list, 'What day would you like to see music?');
        await dc.context.sendActivity(dayMessage);
    },
    async function(dc,response) {
        var state = conversationState.get(dc.context);
        //await dc.context.sendActivity(`You said ${response}`);
        state.navDay = response;
        var facetResults : DGFacets = await genreSearch();
        var genres = facetResults.genre;
        var list : string[] = [];
        for (var i = 0; i < genres.length; i++) {
            list[i] = genres[i].value;
        }
        list[list.length] = 'Any';
        var dayQuestion : string;
        if (state.navDay === 'Any') {
            dayQuestion = 'What genre of music would you like to see?';
        }
        else {
            dayQuestion = `What genre of music would you like to see on ${state.navDay}?`;
        }
        const genreMessage = MessageFactory.suggestedActions(list, dayQuestion);
        await dc.context.sendActivity(genreMessage);
    },
    async function (dc, result) {
        var state = conversationState.get(dc.context);
        state.navGenre = result;
        //Search and find the count to post plural response
        var searchResult : Band[] = await navSearch(state.navDay, state.navGenre);
        var state = conversationState.get(dc.context);
        state.currentBands = searchResult;
        //Create message
        var pluralShow: string = searchResult.length > 1 ? 'shows' : 'show';
        var pluralIs : string = searchResult.length > 1 ? 'are' : 'is';
        var totalMessage : string;
        if (state.navDay === 'Any' && state.navGenre === 'Any') {
            totalMessage = `Here ${pluralIs} the ${pluralShow}!`
        }
        else if (state.navDay === 'Any') {
            totalMessage = `Here ${pluralIs} ${state.navGenre} the ${pluralShow}!`
        }
        else if (state.navGenre === 'Any') {
            totalMessage = `Here ${pluralIs} the ${pluralShow} on ${state.navDay}!`
        }
        else {
            totalMessage = `Here ${pluralIs} the ${state.navGenre} ${pluralShow} on ${state.navDay}!`;
        }
        if (searchResult.length >= 1) {
            await dc.context.sendActivity(totalMessage);
            var l : number = searchResult.length;
            var list = [];
            for (var i : number = 0; i < l; i++) {
                list[i] = CardFactory.heroCard(
                    searchResult[i].bandName,
                    `${searchResult[i].day}, ${searchResult[i].startTime} at the ${searchResult[i].stage} Stage`,
                    [await findPictureURL(searchResult[i].imageUrl)],
                    [{
                        type: ActionTypes.PostBack,
                        title: 'Description',
                        value: `${i}: Description`,
                    },
                    {
                        type: ActionTypes.ImBack,
                        title: 'Back to Main Menu',
                        value: 'Back to Main Menu' 
                    }]
                )
            }
            //caroussel
            await dc.context.sendActivity(MessageFactory.carousel(list));
        }
        else {
            await dc.context.sendActivity("There is no bands with that genre on that day!");
            state.currentBands = [];
            refreshBot(state);
            dc.end();
            dc.begin("MainMenuDialog")
        }
    },
    async function (dc, result) {
        var state = conversationState.get(dc.context);
        if (result === 'Back to Main Menu') {
            await dc.end();
            await dc.begin('MainMenuDialog');            
        }
        else {
            var first : string = result[0];
            await dc.context.sendActivity(state.currentBands[first].description);
            state.currentBands = [];
            refreshBot(state);
            await dc.end();
            await dc.begin('MainMenuDialog');
        }        
    }
])

dialogs.add('textPrompt', new botbuilder_dialogs.TextPrompt());
dialogs.add('choicePrompt', new botbuilder_dialogs.ChoicePrompt());