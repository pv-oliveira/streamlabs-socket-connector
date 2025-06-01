const SockJS = require("sockjs-client")

const PORT = 59650;

class StreambLabsConnector {
  hostname = "";
  port = "";
  socket = "";
  scenes = [];
  status = 'disconnected';
  token = "";
  nextRequestId = 1;
  requests = {};
  subscriptions = {};
  url = `http://127.0.0.1:${PORT}/api` //`http://${location.hostname}:${PORT}/api`,

  request(resourceId, methodName, ...args) {
    let id = this.nextRequestId++;
    let requestBody = {
      jsonrpc: '2.0',
      id,
      method: methodName,
      params: { resource: resourceId, args }
    };
    return this.sendMessage(requestBody);
  }

  sendMessage(message) {
    let requestBody = message;
    if (typeof message === 'string') {
      try {
        requestBody = JSON.parse(message);
      } catch (e) {
        alert('Invalid JSON');
        return;
      }
    }

    if (!requestBody.id) {
      alert('id is required');
      return;
    }

    // this.logMessage(requestBody, 'request');

    return new Promise((resolve, reject) => {
      this.requests[requestBody.id] = {
        body: requestBody,
        resolve,
        reject,
        completed: false
      };
      this.socket.send(JSON.stringify(requestBody));
    });
  };


  switchScene(newSceneId, currentSceneId) {
    this.request('ScenesService', 'makeSceneActive', newSceneId);
    this.request('TransitionsService', 'executeStudioModeTransition')
    // setTimeout(() => {
    //   this.request('ScenesService', 'makeSceneActive', currentSceneId);
    // }, 1000) 
  }

  getScenes() {
    return this.scenes;
  }

  connect() {
    if (this.status !== 'disconnected') return;
    this.status = 'pending';
    this.socket = new SockJS(this.url);

    this.socket.onopen = () => {
      // send token for auth
      this.request('TcpServerService', 'auth', this.token).then(() => {
        this.onConnectionHandler();
      }).catch(e => {
        console.log(e.message)
        // alert(e.message);
      })
    };

    this.socket.onmessage = (e) => {
      this.onMessageHandler(e.data);
      // this.logMessage(e.data.toString(), 'response');
    };

    this.socket.onclose = (e) => {
      this.status = 'disconnected';
      console.log('close', e);
    };
  }

  async onConnectionHandler() {
    this.status = 'connected';

    this.request('ScenesService', 'getScenes').then(scenes => {
      scenes.forEach(scene => this.addScene(scene));
    });

    this.request('ScenesService', 'activeSceneId').then(id => {
      const scene = this.scenes.find(scene => scene.id === id);
      scene.isActive = true;
      this.onSceneSwitchedHandler(scene);
    });

    this.subscribe('ScenesService', 'sceneSwitched', activeScene => {
      this.onSceneSwitchedHandler(activeScene);
    });

    this.subscribe('ScenesService', 'sceneAdded', scene => {
      this.addScene(scene);
    });

    this.subscribe('ScenesService', 'sceneRemoved', scene => {
      this.removeScene(scene.id);
    });

    this.subscribe('SourcesService', 'sourceUpdated', source => {
      this.onSourceUpdatedHandler(source);
    });

    this.subscribe('ScenesService', 'itemAdded', scenItem => {
      this.onSceneItemAdded(scenItem);
    });

    this.subscribe('ScenesService', 'itemUpdated', scenItem => {
      this.onSceneItemUpdateHandler(scenItem);
    });
  };

  subscribe(resourceId, channelName, cb) {
    this.request(resourceId, channelName).then(subscriptionInfo => {
      this.subscriptions[subscriptionInfo.resourceId] = cb;
    });
  };

  removeScene(sceneId) {
    this.scenes.splice(this.scenes.findIndex(scene => scene.id == sceneId), 1);
  };

  onSourceUpdatedHandler(sourceModel) {
    try {
      // 1) Verifica se o payload veio com o ID esperado
      if (!sourceModel || !sourceModel.sourceId) {
        console.warn('⚠️ onSourceUpdatedHandler recebeu sourceModel inválido:', sourceModel);
        return;
      }
  
      // 2) Verifica se já existe o array de fontes (sources)
      if (!this.sources) {
        console.warn('⚠️ onSourceUpdatedHandler: this.sources ainda não foi inicializado.');
        return;
      }
  
      // 3) Tenta encontrar a fonte correspondente pelo sourceId
      let source = this.sources.find(s => s.sourceId === sourceModel.sourceId);
      if (!source) {
        console.warn(`⚠️ Source não encontrada para sourceId=${sourceModel.sourceId}`, {
          sourceModel,
          todasAsSources: this.sources
        });
        return;
      }
  
      // 4) Se tudo estiver ok, faz o merge dos dados recebidos com o objeto existente
      Object.assign(source, sourceModel);
  
      // 5) (Opcional) se você quiser reagir a essa atualização, 
      //    por exemplo emitindo um evento interno ou atualizando cache:
      // this.emit('source-updated', source);
  
    } catch (err) {
      // 6) Captura qualquer outro erro inesperado e loga no console
      console.error('❌ Erro em onSourceUpdatedHandler:', err);
      console.error('Payload de sourceModel:', sourceModel);
      console.error('Estado atual de this.sources:', this.sources);
      // Não relançamos, para não derrubar o processo
    }
  }

  onSceneItemUpdateHandler(sceneItemModel) {
    try {
      if (!sceneItemModel.sceneItemId) return;
      if (!this.sceneItems) return;
      let sceneItem = this.sceneItems.find(sceneItem => sceneItem.sceneItemId === sceneItemModel.sceneItemId);
      console.log(sceneItem, sceneItemModel);
      Object.assign(sceneItem, sceneItemModel);
    } catch (error) {
      console.error('Error updating scene item:', error);
      console.error('Scene Item Model:', sceneItemModel);
      console.error('Scene Items:', this.sceneItems);      
    }
  };

  onSceneItemAdded(sceneItemModel) {
    this.sceneItems.push(sceneItemModel);
  }

  onSceneSwitchedHandler(activeSceneModel) {
    let activeScene = null;
    this.scenes.forEach(scene => {
      scene.isActive = scene.id === activeSceneModel.id;
      if (scene.isActive) activeScene = scene;
    });
    this.request('AudioService', 'getSourcesForCurrentScene').then(sources => this.audioSources = sources);
    this.request(activeScene.resourceId, 'getItems').then(items => this.sceneItems = items);
  };

  addScene(scene) {
    this.scenes.push({ ...scene, isActive: false });
  }

  onMessageHandler(data) {
    let message = JSON.parse(data);
    let request = this.requests[message.id];

    if (request) {
      if (message.error) {
        request.reject(message.error);
      } else {
        request.resolve(message.result);
      }
      delete this.requests[message.id];
    }

    const result = message.result;
    if (!result) return;

    if (result._type === 'EVENT' && result.emitter === 'STREAM') {
      this.subscriptions[message.result.resourceId](result.data);
    }

  }
}
module.exports = StreambLabsConnector;