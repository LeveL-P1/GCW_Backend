"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscribe = subscribe;
exports.publishEvent = publishEvent;
const subscribers = [];
function subscribe(handler) {
    subscribers.push(handler);
}
async function publishEvent(event) {
    for (const handler of subscribers) {
        try {
            await handler(event);
        }
        catch (err) {
            console.error("Event handler error:", err);
        }
    }
}
