// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require("./intentrecognizer")

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');
        
        // create a QnAMaker connector
        this.QnAMaker = new QnAMaker(configuration.QnAConfiguration, qnaOptions)
       
        // create a DentistScheduler connector
        this.DentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration);
      
        // create a IntentRecognizer connector
        this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration)

        this.onMessage(async (context, next) => {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
            const qnaResults = await this.QnAMaker.getAnswers(context);
          
            // send user input to IntentRecognizer and collect the response in a variable
            // don't forget 'await'
            const LuisResult = await this.intentRecognizer.executeLuisQuery(context);
                     
            // determine which service to respond with based on the results from LUIS //
            const av = checkIntent(LuisResult, 'GetAvailability')
            if (av && av.length == 2) {
                const all_av = await this.DentistScheduler.getAvailability();
                await context.sendActivity(all_av);
                await next();
            } else {

                const app = checkIntent(LuisResult, 'ScheduleAppointment')
                if (app && app.length == 2) {
                    const reqTime = app[1]
                    if (!reqTime) {
                        await context.sendActivity('When would you like an appointment?')
                    } else {
                        const schedule_aswer = await this.DentistScheduler.scheduleAppointment(reqTime)
                        await context.sendActivity(schedule_aswer);
                    }

                    await next();
                } else {
                    // If an answer was received from QnA Maker, send the answer back to the user.
                    if (qnaResults[0]) {
                        await context.sendActivity(`${qnaResults[0].answer}`);
                    }
                    else {
                        // If no answers were returned from QnA Maker, reply with help.
                        await context.sendActivity(`I can answer questions about appointments`);
                    }
                }
            }

            



            // if(top intent is intentA and confidence greater than 50){
            //  doSomething();
            //  await context.sendActivity();
            //  await next();
            //  return;
            // }
            // else {...}

            
             
            await next();
    });

        this.onMembersAdded(async (context, next) => {
        const membersAdded = context.activity.membersAdded;
        //write a custom greeting
        const welcomeText = 'Hello, I am here to help you make appointments. ' +
            'Ask me when we are free and then ask me to make an appointment for you.';
        for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
            if (membersAdded[cnt].id !== context.activity.recipient.id) {
                await context.sendActivity(MessageFactory.text(welcomeText, welcomeText));
            }
        }
        // by calling next() you ensure that the next BotHandler is run.
        await next();
    });

    function getIntentByName(intents, intentName){
        if (intentName === 'GetAvailability')
            return intents.GetAvailability
        
        if (intentName === 'ScheduleAppointment') {
            return intents.ScheduleAppointment
        }

        return null
    }

    function checkIntent(luisResult, intentName){
        if (!luisResult) return null

        if (luisResult.luisResult.prediction.topIntent !== intentName) return null

        const intent = getIntentByName(luisResult.intents, intentName) 
        
        if (!intent || intent.score < .6) return null

        if (luisResult.entities.$instance && 
            luisResult.entities.$instance.appointment_time &&
            luisResult.entities.$instance.appointment_time[0]){

                const requested_time = luisResult.entities.$instance.appointment_time[0].text;
                return [intent, requested_time]
            }

        return [intent, null]
        /*
        if (LuisResult.luisResult.prediction.topIntent === intentName &&
        LuisResult.intents.findParking.score > .6 &&
        LuisResult.entities.$instance && 
        LuisResult.entities.$instance.location && 
        LuisResult.entities.$instance.location[0]
        ) {
        const location = LuisResult.entities.$instance.location[0].text;
        // call api with location entity info
        const getLocationOfParking = "I found parking with a charging station at " + location;
        console.log(getLocationOfParking)
        await context.sendActivity(getLocationOfParking);
        await next();
        return;
    }*/
    }

    }
}

module.exports.DentaBot = DentaBot;
