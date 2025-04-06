require('dotenv').config();

const express = require('express');
const logger = require('morgan');
const cors = require('cors');
const routes = require('./routes');
const bodyParser = require('body-parser');
const cron = require('node-cron');
const { createStocks } = require('./controllers/stock');
const { updateIfClosed } = require('./controllers/jump');
const { createLoanRankings } = require('./controllers/loan');

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const app = express();
global.__basedir = __dirname;

// 設定排程
cron.schedule('0 8 * * *', async () => {
    console.log('Running daily updated task after 14:00 every day');
    try {
        await createStocks();
        await updateIfClosed();
        console.log('Daily updated task completed successfully');
    } catch (error) {
        console.error('Error running daily updated task:', error);
    }
});
cron.schedule('0 16 * * *', async () => {
    console.log('Running daily updated task at 22:00 every day');
    try {
        await createLoanRankings(); 
        console.log('Daily updated task completed successfully');
    } catch (error) {
        console.error('Error running daily updated task:', error);
    }
});
if (NODE_ENV !== 'development') {
    const corsOptions = {
        origin: ['https://dylantsouy.github.io'],
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true, 
    };
    app.use(cors(corsOptions));
} else {
    app.use(cors()); 
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use('/api', routes);
app.use(logger('dev'));

app.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}/api/`));