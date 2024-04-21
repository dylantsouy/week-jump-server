const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const routes = require('./routes');
const bodyParser = require('body-parser');
const PORT = process.env.PORT || 5000;
const app = express();
global.__basedir = __dirname;
const cron = require('node-cron');
const { createStocks } = require('./controllers/stock');
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

cron.schedule('0 14 * * *', async () => {
    console.log('Running createStocks task at 14:00 every day');
    try {
        await createStocks();
        console.log('createStocks task completed successfully');
    } catch (error) {
        console.error('Error running createStocks task:', error);
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors());

app.use('/api', routes);

app.use(logger('dev'));

app.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}/api/`));
