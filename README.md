
# YTunes

A small, easy-to-deploy Alexa skill that can stream YouTube videos. Inspired from [jukebox](https://github.com/crd/jukebox).

## Features

- Play audio (and video if supported) from YouTube videos.
- Player-like behavior that allows you to skip forward/backward.
- Very easy to deploy, just run index.js:handle()

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/)
- [TypeScript](https://www.typescriptlang.org/)

### Setup

For incredibly easy deployment, I recommend the usage of AWS Lambda, which perfectly integrates with your Alexa Skill. You will need to set up AWS Lambda, and then integrate it with your Alexa Skill.

#### 1. Building the project

```bash
    npm install # Or yarn install if you prefer
    tsc
```

From there you will have an out directory with the compiled JavaScript files. With your favorite zipping utility you will have to zip the files contained in the out directory, as well as the node_modules directory. Be sure to not include the out directory itself, as you will have to change the handler in the runtime configuration if you do. I have also included a ytunes.zip file that you can use as a reference. You will need to upload this zip file to AWS Lambda.

#### 2. AWS Lambda Setup

1. Create an [AWS](https://aws.amazon.com/) account if you don't have one already.
2. Once created, go to the [AWS Lambda](https://console.aws.amazon.com/lambda/home) console.
3. From there, click on the "Create Function" button.
4. Make sure the runtime is set to Node.js X.x, it should be the default. You can name the function whatever you want.
5. Once created, you will be taken to the function's page. Click on the "Code" tab.
6. From there, click on the "Upload from" dropdown and select "Upload a .zip file".
7. Upload the zip file you created in the previous step, or the one included in this repository.
8. Once uploaded, click on the "Configuration" tab. Under "Environment variables", add a new variable called "API_KEY" and set it to your YouTube API key. You can get one [here](https://developers.google.com/youtube/v3/getting-started).

#### 3. Alexa Skill Setup: from [jukebox](https://github.com/crd/jukebox)

1. Go to the Alexa Console (<https://developer.amazon.com/alexa/console/ask>).
2. If you have not registered as an Amazon Developer then you will need to do so. Fill in your details and ensure you answer "NO" for "Do you plan to monetize apps by charging for apps or selling in-app items" and "Do you plan to monetize apps by displaying ads from the Amazon Mobile Ad Network or Mobile Associates?"
3. Once you are logged into your account click "Create Skill" on the right-hand side.
4. Give your skill any name, eg "My YouTube Skill".
5. Important Set the language to whatever your Echo device is set to. If you are not sure, go to the Alexa app, go to Settings, Device Settings, then click on your Echo device, and look under Language. If your Echo is set to English (UK), then the skill must be English (UK), other types of English will not work!
6. Choose "Custom" as your model, and "Provision Your Own" as your method, then click "Create Skill". On the template page, choose "Start from scratch".
7. On the left hand side, click "JSON Editor".
8. Delete everything in the text box, and copy in the text from <https://raw.githubusercontent.com/ndg63276/alexa-youtube/master/InteractionModel_en.json>, (or use InteractionModel_fr.json, InteractionModel_it.json, InteractionModel_de.json, InteractionModel_es.json for French, Italian, German or Spanish)
9. Click "Save Model" at the top.
10. Click "Interfaces" in the menu on the left, and enable "Audio Player" and "Video App". Click "Save Interfaces".
11. Click "Endpoint" in the menu on the left, and select "AWS Lambda ARN". Under "Default Region", put the ARN of your Lambda function. You can find this by going to the Lambda console, clicking on your function, and copying the ARN from the top right. It should look something like this: `arn:aws:lambda:us-east-1:123456789012:function:myFunctionName`
12. Click "Save Endpoints".
13. Copy your Skill ID which is in the same place as where you copied the ARN. It should look something like this: `amzn1.ask.skill.12345678-1234-1234-1234-123456789012`. You will need this later.
14. Click "Custom" in the menu on the left.
15. Click "Invocation" in the menu on the left.
16. If you want to call the skill anything other than "youtube", change it here. Click "Save Model" if you change anything.
17. Click "Build Model". This will take a minute, be patient. It should tell you if it succeeded.
18. Important: At the top, click "Test". Where it says "Test is disabled for this skill", change the dropdown from "Off" to "Development".

#### 4. Connecting the two

1. Go back to your lambda function, and click on the "Add trigger" button. You will select Alexa Skills Kit as the trigger.
2. Paste your Skill ID in the Skill ID field.
3. Click "Add" at the bottom.

## Usage/Examples

Like all Alexa skills, use the invocation name "youtube" or whatever you want to set it to. For example:

- In English, say "Alexa, launch YouTube".
- In German, say "Alexa, öffne YouTube".
- In Italian, say "Alexa, avvia YouTube".
- In Spanish, say "Alexa, abrir YouTube".

## Acknowledgements

- [jukebox](https://awesomeopensource.com/project/elangosundar/awesome-README-templates) - This project was inspired by the jukebox project, which is a similar project that allows you to stream music from YouTube, written in Python, which is a fork of a project called [alexa-youtube](https://github.com/ndg63276/alexa-youtube), a paid project.
