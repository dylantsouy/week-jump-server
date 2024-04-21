const { Tracking, News } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');

const createTracking = async (req, res) => {
    try {
        const { newsId, date, content, type, sort, fromWhere } = req.body;

        if (!newsId || !date || !type || !sort) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }
        const news = await News.findOne({ where: { id: newsId } });
        if (!news) {
            return res.status(400).json({ message: 'Id is not found', success: false });
        }

        const body = {
            sort,
            date,
            content,
            type,
            newsId,
            fromWhere,
        };

        const data = await Tracking.create(body);
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllTrackings = async (req, res) => {
    try {
        const { newsId } = req.params;

        if (!newsId) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const data = await Tracking.findAll({
            where: { newsId },
        });

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};
const updateTracking = async (req, res) => {
    try {
        const { id } = req.params;

        const body = {
            sort: req.body.sort,
            date: req.body.date,
            content: req.body.content,
            type: req.body.type,
            fromWhere: req.body.fromWhere,
        };

        const [updated] = await Tracking.update(body, {
            where: { id },
        });
        const data = await Tracking.findOne({ where: { id } });
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

const deleteTracking = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Tracking.destroy({
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
    createTracking,
    updateTracking,
    deleteTracking,
    getAllTrackings,
};
