let axios = require('axios');
let baseUrl = 'http://localhost:8080/engine-rest';
let eventUrl = 'https://eec62d48.ngrok.io';
let jwtKey = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6MSwicGFydG5lcl9pZCI6MCwibmFtZSI6InRpY2tldHgiLCJhdXRoX3R5cGUiOiJtYXN0ZXIiLCJ0aW1lc3RhbXAiOjE1NDIzNTg2MDkzNjQuOTc3OH0.5xFtVgMrDiXR3gDUseLUkr5VMWwInmL_xZ4XUiW9_zU';
let { Client, logger, Variables } = require('camunda-external-task-client-js');

// Set up some configs
let config = { baseUrl };
let camundaClient = new Client(config);
axios.defaults.headers.common['Authorization'] = jwtKey;

// Set event data to be created
let data = {
	partner_id: 1,
	name: 'Festival Jajanan Bango',
	location: 'Istora Senayan',
	start_at: 1,
	end_at: 2
};

camundaClient.subscribe('validate-event-detail', async function({ task, taskService }) {
	let processVariables = new Variables();
	let status = true;
	// Invoke Create Event REST service
	try {
		let response = await axios.get(eventUrl+'/event/history');
		response.data.forEach(event => {
			if(event.name === data.name) status = false;
		});
		processVariables.set("validated", status);
	} catch(err) {
		console.log(err);
		processVariables.set("validated", false);
		status = false;
	}
	console.log(`Did validate-event-detail. Set variable validated = ${status}`);
    await taskService.complete(task, processVariables);
});

camundaClient.subscribe('add-event', async function({ task, taskService }) {
	let response;
	try {
		response = await axios.post(eventUrl+'/event', data);
	} catch(err) {
		throw err;
	}
	console.log(`Did add-event with event-name = ${response.data.name}`);
	await taskService.complete(task);
});

camundaClient.subscribe('issue-ticket', async function({ task, taskService }) {
	console.log(`Did issue-ticket`);
	await taskService.complete(task);
});

camundaClient.subscribe('notify-partner', async function({ task, taskService }) {
	console.log(`Did notify-partner`);
	await taskService.complete(task);
});

camundaClient.start();