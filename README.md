# streamlabs-socket-connector

# How to use with Holyrics

// STREAMLABS ---------------------------
URL = http://localhost:3001/streamlabs
```
var streamlabsconnectorId = ""

function startConnectorStreamLabs(scene){
    h.log("Starting scene: " + scene )
	var response = h.apiRequest(streamlabsconnectorId, {
        url_suffix: '/activateScene',
        headers: {
            'Content-Type': 'application/json'
          },
        type: 'POST',
        data: {
            "scene": scene,
        }
    });

    logResponse(response)
}
``` 