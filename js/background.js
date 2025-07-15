// Service Worker for Manifest V3 - Redirector Extension
// Import redirect.js functionality
importScripts('redirect.js');

function log(msg, force) {
	if (log.enabled || force) {
		console.log('REDIRECTOR: ' + msg);
	}
}
log.enabled = true; // Enable logging by default for debugging
var enableNotifications = false;

function isDarkMode() {
	// Service Workers don't have access to window.matchMedia
	// We'll need to handle dark mode detection differently or remove this feature
	// For now, return false as default
	return false;
}
var isFirefox = !!navigator.userAgent.match(/Firefox/i);

var storageArea = chrome.storage.local;

// Store current redirect rules
var currentRedirects = [];

function setIcon(image) {
	var data = { 
		path: {}
	};

	for (let nr of [16, 19, 32, 38, 48, 64, 128]) {
		data.path[nr] = `images/${image}-${nr}.png`;
	}

	chrome.action.setIcon(data, function() {
		var err = chrome.runtime.lastError;
		if (err) {
			log('Error in SetIcon: ' + err.message);
		}
	});		
}

// Convert redirects to declarativeNetRequest rules
function convertRedirectsToRules(redirects) {
	const rules = [];
	let ruleId = 1; // Start from 1 since all existing rules should be cleared first

	for (const redirect of redirects) {
		if (redirect.disabled) continue;

		try {
			// Create redirect object for processing
			const redirectObj = new Redirect(redirect);
			
			// Skip if there are compilation errors
			if (redirectObj.error) {
				log('Skipping redirect due to error: ' + redirectObj.error);
				continue;
			}

			const rule = {
				id: ruleId++,
				priority: 1,
				action: {
					type: 'redirect'
				},
				condition: {}
			};

		// Handle different pattern types
		if (redirect.patternType === 'W') { // Wildcard
			// Convert wildcard pattern to URL filter for declarativeNetRequest
			let urlFilter = redirect.includePattern;
			
			// Ensure protocol is present
			if (!urlFilter.includes('://')) {
				urlFilter = '*://' + urlFilter;
			}
			
			rule.condition.urlFilter = urlFilter;
		} else if (redirect.patternType === 'R') { // Regex
			try {
				// Test if regex is valid
				new RegExp(redirect.includePattern);
				rule.condition.regexFilter = redirect.includePattern;
			} catch (e) {
				log('Invalid regex pattern: ' + redirect.includePattern + ', error: ' + e.message);
				continue;
			}
		} else {
			// Default to treating as urlFilter
			let urlFilter = redirect.includePattern;
			if (!urlFilter.includes('://')) {
				urlFilter = '*://' + urlFilter;
			}
			rule.condition.urlFilter = urlFilter;
		}

		// Set resource types
		const resourceTypes = [];
		if (redirect.appliesTo && redirect.appliesTo.length > 0) {
			for (const type of redirect.appliesTo) {
				// Skip 'history' type as it's handled separately
				if (type === 'history') continue;
				
				switch (type) {
					case 'main_frame':
						resourceTypes.push('main_frame');
						break;
					case 'sub_frame':
						resourceTypes.push('sub_frame');
						break;
					case 'stylesheet':
						resourceTypes.push('stylesheet');
						break;
					case 'script':
						resourceTypes.push('script');
						break;
					case 'image':
						resourceTypes.push('image');
						break;
					case 'font':
						resourceTypes.push('font');
						break;
					case 'object':
						resourceTypes.push('object');
						break;
					case 'xmlhttprequest':
						resourceTypes.push('xmlhttprequest');
						break;
					case 'media':
						resourceTypes.push('media');
						break;
					case 'other':
						resourceTypes.push('other');
						break;
				}
			}
		}
		
		// If no valid resource types or only history, default to main_frame
		if (resourceTypes.length === 0) {
			resourceTypes.push('main_frame');
		}
		
		rule.condition.resourceTypes = resourceTypes;

		// Handle redirect URL
		if (redirect.redirectUrl.includes('$')) {
			// For patterns with substitution groups (both regex and wildcard)
			if (redirect.patternType === 'W') {
				// Convert wildcard pattern to regex for substitution
				const redirectObj = new Redirect(redirect);
				rule.condition.regexFilter = redirectObj._preparePattern(redirect.includePattern);
				delete rule.condition.urlFilter; // Remove urlFilter when using regexFilter
			}
			rule.action.regexSubstitution = redirect.redirectUrl;
		} else {
			// For simple redirects without substitution
			rule.action.redirect = { url: redirect.redirectUrl };
		}

		rules.push(rule);
		log(`Created rule ${rule.id}: ${redirect.includePattern} -> ${redirect.redirectUrl}`);
		
		} catch (error) {
			log('Error processing redirect rule: ' + error.message + ', redirect: ' + JSON.stringify(redirect));
		}
	}

	return rules;
}

// Update declarativeNetRequest rules
async function updateDeclarativeRules() {
	try {
		log('Updating declarativeNetRequest rules...');
		
		const result = await chrome.storage.local.get({ redirects: [] });
		const redirects = result.redirects;
		
		// Step 1: Get and remove ALL existing rules first
		const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
		const existingRuleIds = existingRules.map(rule => rule.id);
		
		if (existingRuleIds.length > 0) {
			log(`Removing ${existingRuleIds.length} existing rules: [${existingRuleIds.join(', ')}]`);
			await chrome.declarativeNetRequest.updateDynamicRules({
				removeRuleIds: existingRuleIds
			});
			
			// Wait a bit to ensure removal is complete
			await new Promise(resolve => setTimeout(resolve, 100));
			
			// Verify rules are cleared
			const remainingRules = await chrome.declarativeNetRequest.getDynamicRules();
			if (remainingRules.length > 0) {
				log(`Warning: ${remainingRules.length} rules still exist after removal`);
				// Force remove any remaining rules
				const remainingIds = remainingRules.map(r => r.id);
				await chrome.declarativeNetRequest.updateDynamicRules({
					removeRuleIds: remainingIds
				});
				await new Promise(resolve => setTimeout(resolve, 50));
			}
		}
		
		if (redirects.length === 0) {
			log('No redirects defined, all rules cleared');
			return;
		}

		currentRedirects = redirects;
		
		// Step 2: Generate new rules with fresh IDs starting from 1
		const newRules = convertRedirectsToRules(redirects);
		
		log(`Converting ${redirects.length} redirects to ${newRules.length} declarativeNetRequest rules`);

		if (newRules.length === 0) {
			log('No valid rules to add');
			return;
		}

		// Step 3: Add new rules
		log(`Adding rules with IDs: [${newRules.map(r => r.id).join(', ')}]`);
		await chrome.declarativeNetRequest.updateDynamicRules({
			addRules: newRules
		});
		log('Successfully updated declarativeNetRequest rules');
		
	} catch (error) {
		log('Error updating declarativeNetRequest rules: ' + error.message, true);
	}
}

// Handle history state changes (for SPA redirects like Facebook, Twitter)
function checkHistoryStateRedirects(details) {
	storageArea.get({ redirects: [] }, function(obj) {
		const redirects = obj.redirects;
		const historyRedirects = redirects.filter(r => 
			r.appliesTo && r.appliesTo.includes('history') && !r.disabled
		);
		
		for (const redirect of historyRedirects) {
			const redirectObj = new Redirect(redirect);
			const result = redirectObj.getMatch(details.url);
			
			if (result.isMatch) {
				log('History state redirect: ' + details.url + ' -> ' + result.redirectTo);
				chrome.tabs.update(details.tabId, { url: result.redirectTo });
				
				if (enableNotifications) {
					sendNotifications(redirect, details.url, result.redirectTo);
				}
				break;
			}
		}
	});
}

// Sets on/off badge, and updates dark/light mode icon
function updateIcon() {
	chrome.storage.local.get({ disabled: false, darkMode: false }, function(obj) {
		// Update icon based on theme preference (stored in settings)
		// Since Service Workers can't access window.matchMedia, we use stored preference
		if (!isFirefox) {
			if (obj.darkMode) {
				setIcon('icon-dark-theme');
			} else {
				setIcon('icon-light-theme');
			}
		}

		if (obj.disabled) {
			chrome.action.setBadgeText({ text: 'off' });
			chrome.action.setBadgeBackgroundColor({ color: '#fc5953' });
			if (chrome.action.setBadgeTextColor) {
				chrome.action.setBadgeTextColor({ color: '#fafafa' });
			}
		} else {
			chrome.action.setBadgeText({ text: 'on' });
			chrome.action.setBadgeBackgroundColor({ color: '#35b44a' });
			if (chrome.action.setBadgeTextColor) {
				chrome.action.setBadgeTextColor({ color: '#fafafa' });
			}
		}
	});	
}

// Monitor changes in data, and setup everything again
function monitorChanges(changes, namespace) {
	if (changes.disabled) {
		updateIcon();
		chrome.storage.local.get({ disabled: false }, function(obj) {
			if (obj.disabled) {
				// Clear all rules when disabled
				chrome.declarativeNetRequest.getDynamicRules().then(rules => {
					if (rules.length > 0) {
						chrome.declarativeNetRequest.updateDynamicRules({
							removeRuleIds: rules.map(r => r.id)
						});
					}
				});
			} else {
				// Re-setup rules when enabled
				updateDeclarativeRules();
			}
		});
	}

	if (changes.redirects) {
		log('Redirects have changed, updating rules');
		updateDeclarativeRules();
	}

	if (changes.logging) {
		log.enabled = changes.logging.newValue;
	}

	if (changes.enableNotifications) {
		enableNotifications = changes.enableNotifications.newValue;
	}
}

// Message handling
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	log('Received background message: ' + JSON.stringify(request));
	
	if (request.type == 'get-redirects') {
		log('Getting redirects from storage');
		storageArea.get({ redirects: [] }, function (obj) {
			log('Got redirects from storage: ' + JSON.stringify(obj));
			sendResponse(obj);
			log('Sent redirects to content page');
		});
		return true; // Keep sendResponse alive for async response
	} else if (request.type == 'save-redirects') {
		console.log('Saving redirects, count=' + request.redirects.length);
		delete request.type;
		storageArea.set(request, async function () {
			if (chrome.runtime.lastError) {
				if (chrome.runtime.lastError.message.indexOf("QUOTA_BYTES_PER_ITEM quota exceeded") > -1) {
					log("Redirects failed to save as size of redirects larger than allowed limit per item by Sync");
					sendResponse({
						message: "Redirects failed to save as size of redirects larger than what's allowed by Sync. Refer Help Page"
					});
				}
			} else {
				log('Finished saving redirects to storage');
				// Update rules after saving
				try {
					await updateDeclarativeRules();
					sendResponse({
						message: "Redirects saved"
					});
				} catch (error) {
					log('Error updating rules after save: ' + error.message, true);
					sendResponse({
						message: "Redirects saved but rules update failed: " + error.message
					});
				}
			}
		});
		return true; // Keep sendResponse alive for async response
	} else if (request.type == 'update-icon') {
		updateIcon();
		return false; // Synchronous response
	} else if (request.type == 'toggle-sync') {
		// Handle sync toggle
		delete request.type;
		log('toggling sync to ' + request.isSyncEnabled);
		chrome.storage.local.set({
			isSyncEnabled: request.isSyncEnabled
		}, async function () {
			if (request.isSyncEnabled) {
				storageArea = chrome.storage.sync;
				chrome.storage.local.getBytesInUse("redirects", function (size) {
					if (size > storageArea.QUOTA_BYTES_PER_ITEM) {
						storageArea = chrome.storage.local; 
						sendResponse({
							message: "Sync Not Possible - size of Redirects larger than what's allowed by Sync. Refer Help page"
						});
					} else {
						chrome.storage.local.get({ redirects: [] }, async function (obj) {
							if (obj.redirects.length > 0) {
								chrome.storage.sync.set(obj, async function () {
									chrome.storage.local.remove("redirects");
									try {
										await updateDeclarativeRules();
										sendResponse({ message: "sync-enabled" });
									} catch (error) {
										log('Error updating rules after sync enable: ' + error.message, true);
										sendResponse({ message: "sync-enabled" });
									}
								});
							} else {
								sendResponse({ message: "sync-enabled" });
							}
						});
					}
				});
			} else {
				storageArea = chrome.storage.local;
				chrome.storage.sync.get({ redirects: [] }, async function (obj) {
					if (obj.redirects.length > 0) {
						chrome.storage.local.set(obj, async function () {
							chrome.storage.sync.remove("redirects");
							try {
								await updateDeclarativeRules();
								sendResponse({ message: "sync-disabled" });
							} catch (error) {
								log('Error updating rules after sync disable: ' + error.message, true);
								sendResponse({ message: "sync-disabled" });
							}
						});
					} else {
						sendResponse({ message: "sync-disabled" });
					}
				});
			}
		});
		return true; // Keep sendResponse alive for async response
	} else {
		log('Unexpected message: ' + JSON.stringify(request));
		sendResponse({ error: 'Unknown message type' });
		return false; // Synchronous response for unknown messages
	}
});

// Notification function
function sendNotifications(redirect, originalUrl, redirectedUrl) {
	log("Showing redirect success notification");
	
	// Use light theme icon by default since we can't detect system theme in Service Worker
	// Could be enhanced to read from user settings if needed
	let icon = "images/icon-light-theme-48.png";

	if (navigator.userAgent.toLowerCase().indexOf("chrome") > -1 && navigator.userAgent.toLowerCase().indexOf("opr") < 0) {
		var items = [
			{ title: "Original page: ", message: originalUrl },
			{ title: "Redirected to: ", message: redirectedUrl }
		];
		var head = "Redirector - Applied rule : " + redirect.description;
		chrome.notifications.create({
			type: "list",
			items: items,
			title: head,
			message: head,
			iconUrl: icon
		});	
	} else {
		var message = "Applied rule : " + redirect.description + " and redirected original page " + originalUrl + " to " + redirectedUrl;
		chrome.notifications.create({
			type: "basic",
			title: "Redirector",
			message: message,
			iconUrl: icon
		});
	}
}

// Setup listeners
chrome.webNavigation.onHistoryStateUpdated.addListener(checkHistoryStateRedirects);
chrome.storage.onChanged.addListener(monitorChanges);

// Initialization
async function initialize() {
	log('Redirector Service Worker starting up...');
	
	try {
		// Setup initial icon
		updateIcon();

		// Get logging preference
		chrome.storage.local.get({ logging: false }, function(obj) {
			log.enabled = obj.logging;
			log('Logging enabled: ' + obj.logging);
		});

		// Get sync preference and setup storage area
		chrome.storage.local.get({ isSyncEnabled: false }, function (obj) {
			log('Sync enabled: ' + obj.isSyncEnabled);
			if (obj.isSyncEnabled) {
				storageArea = chrome.storage.sync;
			} else {
				storageArea = chrome.storage.local;
			}
			setupInitial(); 
		});
	} catch (error) {
		log('Error during initialization: ' + error.message, true);
		console.error('Initialization error:', error);
	}
}

function setupInitial() {
	log('Setting up initial configuration...');
	
	chrome.storage.local.get({ enableNotifications: false }, function(obj) {
		enableNotifications = obj.enableNotifications;
		log('Notifications enabled: ' + obj.enableNotifications);
	});

	chrome.storage.local.get({ disabled: false }, function (obj) {
		log('Extension disabled: ' + obj.disabled);
		if (!obj.disabled) {
			updateDeclarativeRules();
		} else {
			log('Redirector is disabled');
		}
	});
}

// Handle startup events
chrome.runtime.onStartup.addListener(function() {
	log('Extension startup event');
	enableNotifications = false;
	chrome.storage.local.set({ enableNotifications: false });
	updateIcon();
});

chrome.runtime.onInstalled.addListener(function(details) {
	log('Extension installed/updated: ' + details.reason);
	initialize();
});

// Initialize when service worker starts
// Only initialize if this isn't during installation
if (chrome.runtime.getManifest) {
	// Service Worker is ready, initialize
	setTimeout(() => {
		initialize();
	}, 100);
}
