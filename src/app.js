const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const StreambLabsConnector = require("./streamlabs")
// middlewares
app.use(cors());
app.use(express.json());

const streamlabs = new StreambLabsConnector();
streamlabs.connect();

// rotas
app.get('/streamlabs', (req, res) => {
  streamlabs.connect()
  res.send('🚀 API rodando!');
});

app.get('/streamlabs/getScenes', async (req, res) => {
  streamlabs.connect()
  const data = streamlabs.getScenes()

  const list = data.map(item => item.name)
  res.status(200).send(list);
});

app.post('/streamlabs/activateScene', async (req, res) => {
  const { scene } = req.body;
  const scenes = streamlabs.getScenes()
  const currentActiveScene = scenes.find(item => item.isActive === true)
  const newScene = scenes.find(item => item.name === scene)

  streamlabs.switchScene(newScene.id, currentActiveScene.id)
  res.status(200).send('');
});

// start
app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
