/* eslint-disable prettier/prettier */
require('dotenv').config();
const express = require('express');
const swaggerUI = require('swagger-ui-express');
const YAML = require('yamljs');
const OpenApiValidator = require('express-openapi-validator');
const mongoose = require('mongoose');

const swaggerDocs = YAML.load('./swagger.yaml');

// express app
const app = express();

// Global middlewares
app.use(express.json());
app.use('/docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

app.use(
    OpenApiValidator.middleware({
        apiSpec: './swagger.yaml',
    }),
);

app.get('/health', (_req, res) => {
    res.status(200).json({
        health: 'ok',
    });
});

app.use((err, req, res, _next) => {
    // format error
    res.status(err.status || 500).json({
        message: err.message,
        errors: err.errors,
    });
});

mongoose.connect(process.env.DB_URL, {}).then(() => {
    console.log('Database connected successfully');
    app.listen(process.env.PORT, () => {
        console.log('server is running');
        console.log('API documentation: http://localhost:4000/docs');
    });
}).catch((e) => {
    console.log('DB Connection failed');
    console.log(e.message);
});
