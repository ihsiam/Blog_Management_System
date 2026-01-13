const express = require('express');
const swaggerUI = require('swagger-ui-express');
const YAML = require('yamljs');

const swaggerDocs = YAML.load('./swagger.yaml');

// express app
const app = express();
app.use(express.json());
app.use('/docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

app.get('/health', (_req, res) => {
    res.status(200).json({
        health: 'ok',
    });
});

app.listen(4000, () => {
    console.log('server is running');
    console.log('http://localhost:4000');
});
