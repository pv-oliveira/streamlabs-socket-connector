// index.js (ou server.js)
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

const StreambLabsConnector = require("./streamlabs");

// ——————————————————————————————————————————————————————
// 1) CAPTURAR EXCEÇÕES GLOBAIS E REJEIÇÕES NÃO TRATADAS
//    para que o processo não fique travado “no meio do nada”
//    e possamos deixá-lo encerrar (para o process manager reiniciar).
// ——————————————————————————————————————————————————————

process.on('uncaughtException', (err) => {
  console.error('❌ Exceção não tratada:', err);
  // Forçar encerramento do processo com código de erro:
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Rejeição de Promise não tratada em: ', promise);
  console.error('Motivo da rejeição:', reason);
  // Forçar encerramento do processo com código de erro:
  process.exit(1);
});

// ——————————————————————————————————————————————————————
// 2) Middlewares e configuração básica do Express
// ——————————————————————————————————————————————————————
app.use(cors());
app.use(express.json());

const streamlabs = new StreambLabsConnector();

// Sempre que você chamar streamlabs.connect(), envolva em try/catch
// para capturar erros inesperados dessa operação:
(async () => {
  try {
    await streamlabs.connect();
    console.log('✅ Conectado ao Streamlabs com sucesso.');
  } catch (err) {
    console.error('❌ Falha ao conectar no Streamlabs na inicialização:', err);
    // Opcional: se quiser tentar novamente em X segundos, você pode
    // chamar setTimeout(() => conectarNovamente(), 5000); etc.
    process.exit(1); // encerra para o process manager reiniciar
  }
})();

// ——————————————————————————————————————————————————————
// 3) Rotas
// ——————————————————————————————————————————————————————

// Em todas as rotas assíncronas, envolva o código em try/catch
// para que um erro no interno não “vaze” e derrube o servidor inteiro.

app.get('/streamlabs', (req, res) => {
  try {
    // Não há nada realmente assíncrono aqui, 
    // mas se houvesse, deveríamos usar async/await + try/catch
    streamlabs.connect()
      .then(() => res.send('🚀 API rodando!'))
      .catch(err => {
        console.error('Erro ao reconectar no /streamlabs:', err);
        res.status(500).send('Erro ao conectar no Streamlabs.');
      });
  } catch (err) {
    console.error('Erro inesperado na rota GET /streamlabs:', err);
    res.status(500).send('Erro interno.');
  }
});

app.get('/streamlabs/getScenes', async (req, res) => {
  try {
    const data = streamlabs.getScenes();
    const list = data.map(item => item.name);
    res.status(200).send(list);
  } catch (err) {
    console.error('Erro ao buscar cenas em /streamlabs/getScenes:', err);
    res.status(500).send('Erro interno ao obter cenas.');
  }
});

app.post('/streamlabs/activateScene', async (req, res) => {
  try {
    const { scene } = req.body;
    const scenes = streamlabs.getScenes();
    const currentActiveScene = scenes.find(item => item.isActive === true);
    const newScene = scenes.find(item => item.name === scene);

    if (!newScene) {
      return res.status(404).send('Cena não encontrada.');
    }
    await streamlabs.switchScene(newScene.id, currentActiveScene.id);
    res.status(200).send('');
  } catch (err) {
    console.error('Erro ao ativar cena via POST /streamlabs/activateScene:', err);
    res.status(500).send('Erro interno ao ativar cena.');
  }
});

// Versão GET para activateScene (se ainda quiser disponibilizar)
app.get('/streamlabs/activateScene', async (req, res) => {
  try {
    const { scene } = req.query;
    const scenes = streamlabs.getScenes();
    const currentActiveScene = scenes.find(item => item.isActive === true);
    const newScene = scenes.find(item => item.name === scene);

    if (!newScene) {
      return res.status(404).send('Cena não encontrada.');
    }
    await streamlabs.switchScene(newScene.id, currentActiveScene.id);
    res.status(200).send('');
  } catch (err) {
    console.error('Erro ao ativar cena via GET /streamlabs/activateScene:', err);
    res.status(500).send('Erro interno ao ativar cena.');
  }
});

// ——————————————————————————————————————————————————————
// 4) Iniciar o servidor
// ——————————————————————————————————————————————————————
app.listen(PORT, () => {
  console.log(`Servidor iniciado na porta ${PORT}`);
});
