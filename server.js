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
const { updateIfClosed } = require('./controllers/jump');

cron.schedule('0 8 * * *', async () => {
    console.log('Running daily updated task after 14:00 every day');
    try {
        await createStocks();
        await updateIfClosed();
        console.log('daily updated task completed successfully');
    } catch (error) {
        console.error('Error running daily updated task:', error);
    }
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(cors());

app.use('/api', routes);

app.use(logger('dev'));

app.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}/api/`));
