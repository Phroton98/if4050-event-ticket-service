let axios = require('axios');
let { Client, Variables } = require('camunda-external-task-client-js');

const restUrl = 'http://localhost:5050';
const baseUrl = 'http://localhost:8080/engine-rest';

// Create a Client axiosInstance with custom configuration
let config = { baseUrl };
let createEventWorker = new Client(config);
let axiosOptions = {}, axiosInstance;

function validateRequest(event, sectionList) {
	let eventValidate = event.hasOwnProperty("partner_id") && 
											event.hasOwnProperty("name") && 
											event.hasOwnProperty("location") &&
											event.hasOwnProperty("start_at") &&
											event.hasOwnProperty("end_at");
	let sectionValidate = true;
	for (let section of sectionList) {
		sectionValidate = section.hasOwnProperty("name") &&
											section.hasOwnProperty("price") &&
											section.hasOwnProperty("capacity") &&
											section.hasOwnProperty("has_seat")
		if (!sectionValidate) break;
	}
	return sectionValidate && eventValidate;
}

createEventWorker.subscribe('validate-event-detail', async function({ task, taskService }) {
	// Get all variables
	let event = task.variables.get("event");
	let sectionList = task.variables.get("section_list");
	let callback = task.variables.get("callback");
	let callbackType = task.variables.get("callback_type");
	let authKey = task.variables.get("auth_key");
	let status = false, error = "Error", response;
	// Set Process Variables
	let processVariables = new Variables();
	// Running
	if (event && sectionList && callback && callbackType && authKey) {	
		axiosOptions.headers = {'Authorization': authKey, 'Content-Type': 'application/json'};
		axiosInstance = axios.create(axiosOptions);
		try {
			event = await JSON.parse(event);
			sectionList = await JSON.parse(sectionList);
			if (validateRequest(event, sectionList) && event.start_at < event.end_at) {
				response = await axiosInstance.get(`${restUrl}/partner/${event.partner_id}`);
				if (response.status == 200) {
					processVariables.set("event", event);
					processVariables.set("section_list", sectionList);
					status = true;
				}
			}
		} catch (err) {
			error = err.message
		}
	}
	if (!status) processVariables.set("message_error", error);
	processVariables.set("validated", status);
	console.log(`Did validate-event-detail. Set variable validated = ${status}`);
  await taskService.complete(task, processVariables);
});

createEventWorker.subscribe('add-event', async function({ task, taskService }) {
	// Get all variables
	let event = task.variables.get("event");
	let success = false, error = "Error", response;
	// Set Process Variables
	let processVariables = new Variables();

	try {
		response = await axiosInstance.post(`${restUrl}/event/`, event);
		success = true;
		processVariables.set("event", response.data);
	} catch (err) {
		error = err.message;
	}
	if (!success) processVariables.set("message_error", error);
	processVariables.set("success", success);
	console.log('Did add-event');
	await taskService.complete(task, processVariables);
});

createEventWorker.subscribe('issue-ticket', async function({ task, taskService }) {
	// Get all variables
	let event = task.variables.get("event");
	let sectionList = task.variables.get("section_list");
	let success = false, error = "Error", response;
	// Set process variables
	let processVariables = new Variables();
	try {
		let payload = {"event_id": event.id, "section_list": sectionList}
		response = await axiosInstance.post(`${restUrl}/ticket_section/`, payload);
		if (response.status < 400) success = response.data;
	} catch (err) {
		error = err.message;
	}
	if (!success) processVariables.set("message_error", error);
	processVariables.set("success", success);
	console.log(`Did issue-ticket`);
	await taskService.complete(task, processVariables);
});

createEventWorker.subscribe('delete-event', async function({ task, taskService}) {
	let event = task.variables.get("event");
	try {
		await axiosInstance.delete(`${restUrl}/event/${event.id}`);
	} catch (err) {
		console.log(err);
	}
	await taskService.complete(task, processVariables);
});

createEventWorker.subscribe('notify-partner', async function({ task, taskService }) {
	let callbackType = task.variables.get("callback_type");
	let callback = task.variables.get("callback");
	let event = task.variables.get("event");
	let sectionList = task.variables.get("section_list");
	if (callbackType === 'url') {
		await axiosInstance.post(callback, {
			"message": `Event ${event.id} has successfully been created`,
			"event": event,
			"section_list": sectionList
		});
	}
	console.log(`Did notify-partner`);
	await taskService.complete(task);
});

createEventWorker.subscribe('notify-failed-event', async function({ task, taskService }) {
	let callbackType = task.variables.get("callback_type");
	let callback = task.variables.get("callback");
	let msgError = task.variables.get("message_error");
	if (callbackType === 'url') {
		await axiosInstance.post(callback, {
			"message": msgError
		});
	}
	console.log(msgError);
	console.log(`Did notify-failed-event`);
	await taskService.complete(task);
});

module.exports = createEventWorker;