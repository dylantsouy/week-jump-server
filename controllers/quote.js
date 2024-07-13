const { Quote, Stock } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');

const createQuote = async (req, res) => {
    try {
        const { sentence, fromWho, note, type } = req.body;
        if (!sentence) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const body = {
            sentence,
            fromWho,
            note,
            type,
        };

        const data = await Quote.create(body);
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllQuotes = async (req, res) => {
    try {
        const data = await Quote.findAll();

        return res.status(200).json({ data: data, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const updateQuote = async (req, res) => {
    try {
        const { id } = req.params;

        const { sentence, fromWho, note, type } = req.body;
        
        if (!sentence) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const body = { sentence, fromWho, note, type };

        const [updated] = await Quote.update(body, {
            where: { id },
        });
        const data = await Quote.findOne({ where: { id } });
        if (updated) {
            return res.status(200).json({ data, success: true });
        } else {
            if (data) {
                return res.status(400).send({
                    message: 'unexpected error',
                    success: false,
                });
            } else {
                return res.status(400).send({
                    message: 'ID does not exists',
                    success: false,
                });
            }
        }
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const deleteQuote = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Quote.destroy({
            where: { id },
        });
        if (deleted) {
            return res.status(200).send({ message: 'Successful deleted', success: true });
        }
        return res.status(400).send({
            message: 'ID does not exists',
            success: false,
        });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

module.exports = {
    createQuote,
    getAllQuotes,
    updateQuote,
    deleteQuote,
};
