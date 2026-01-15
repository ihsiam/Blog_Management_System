/* eslint-disable comma-dangle */
/* eslint-disable object-curly-newline */
require('dotenv').config();
const express = require('express');
const swaggerUI = require('swagger-ui-express');
const YAML = require('yamljs');
const OpenApiValidator = require('express-openapi-validator');
const articleService = require('./services/Articles');

const swaggerDocs = YAML.load('./swagger.yaml');

// express app
const app = express();
app.use(express.json());
app.use('/docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

app.use(
    OpenApiValidator.middleware({
        apiSpec: './swagger.yaml',
    })
);

app.get('/health', (_req, res) => {
    res.status(200).json({
        health: 'ok',
    });
});

app.get('/api/v1/articles', async (req, res) => {
    // extract params
    const page = +req.query.page;
    const limit = +req.query.limit;

    // retrive articles
    const { totalItems, totalPage, hasNext, hasPrev, articles } = await articleService.findArticles(
        {
            ...req.query,
            page,
            limit,
        }
    );

    // response object
    const response = {
        code: 200,
        message: 'Data retrived',
        data: articleService.transformarticles({ articles }),
        Pagination: {
            page,
            limit,
            totalPage,
            totalItems,
        },
        links: {
            self: `/articles?page=${page}&limit=${limit}`,
        },
    };

    // pagination link
    if (hasPrev) {
        response.Pagination.prev = page - 1;
        response.links.prev = `/articles?page=${page - 1}&limit=${limit}`;
    }

    if (hasNext) {
        response.Pagination.next = page + 1;
        response.links.next = `/articles?page=${page + 1}&limit=${limit}`;
    }

    res.status(200).json(response);
});

app.use((err, req, res, _next) => {
    // format error
    res.status(err.status || 500).json({
        message: err.message,
        errors: err.errors,
    });
});

app.listen(process.env.PORT, () => {
    console.log('server is running');
    console.log('http://localhost:4000/docs');
});
