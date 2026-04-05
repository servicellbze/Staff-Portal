const APP_VERSION = "2.4.0"; // The version currently ON this file

async function checkForUpdates() {
    try {
        // We reuse your existing SCRIPT_URL
        const response = await fetch(`${SCRIPT_URL}?action=getConfig&property=CurrentVersion`);
        const data = await response.json();
        
        if (data.value && data.value !== APP_VERSION) {
            document.getElementById('updateBar').style.display = 'block';
            // Push the main content down so the bar doesn't cover it
            document.body.style.paddingTop = '40px'; 
        }
    } catch (e) {
        console.log("Update check failed (Offline)");
    }
}

// Run the check 2 seconds after the app opens
setTimeout(checkForUpdates, 2000);