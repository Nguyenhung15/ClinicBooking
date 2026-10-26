const express = require('express');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error.middleware');

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Clinic Booking API' });
});

app.use('/api', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
