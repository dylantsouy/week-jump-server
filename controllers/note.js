const { Note } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');


const createNote = async (req, res) => {
    try {
        const { title, type } = req.body;
        if (!title || !type ) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }
        await Note.create(req.body);
        return res.status(200).json({ message: 'Successful Created', success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllNotes = async (req, res) => {
    try {
        const data = await Note.findAll();
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const updateNote = async (req, res) => {
    try {
        const { id } = req.params;

        const body = {
            title: req.body.title,
            type: req.body.type,
            content: req.body.content,
            fromWho: req.body.fromWho,
        };

        const [updated] = await Note.update(body, {
            where: { id },
        });
        const data = await Note.findOne({ where: { id } });
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

const deleteNote = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Note.destroy({
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

const bulkDeleteNote = async (req, res) => {
    try {
        const { ids } = req.body;

        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).send({
                message: 'IDs format error',
                success: false
            });
        }

        const deletedCount = await Note.destroy({
            where: { id: ids }
        });

        if (deletedCount > 0) {
            return res.status(200).send({
                message: `Successful deleted`,
                success: true,
                deletedCount
            });
        } else {
            return res.status(400).send({
                message: 'ID does not exists',
                success: false
            });
        }
    } catch (error) {
        return res.status(500).send({
            message: errorHandler(error),
            success: false
        });
    }
};
module.exports = {
    createNote,
    getAllNotes,
    updateNote,
    deleteNote,
    bulkDeleteNote
};
