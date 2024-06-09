const { Tracking, News } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');

const createTracking = async (req, res) => {
    try {
        const data = await Tracking.create();
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllTrackings = async (req, res) => {
    try {
        const data = await Tracking.findAll();

        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};
module.exports = {
    createTracking,
    getAllTrackings,
};
