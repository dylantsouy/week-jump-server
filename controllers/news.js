const { News, Target, Tracking } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');

const createNews = async (req, res) => {
    try {
        const { targetId, name, date, content, type, status, sort, fromWhere, rate } = req.body;

        if (!targetId || !date || !name || !type || !status || !sort || !rate) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }
        const target = await Target.findOne({ where: { id: targetId } });
        if (!target) {
            return res.status(400).json({ message: 'Id is not found', success: false });
        }

        const body = {
            sort,
            name,
            date,
            rate,
            content,
            targetId,
            type,
            status,
            fromWhere,
        };

        const data = await News.create(body);
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllNames = async (req, res) => {
    try {
        const { targetId } = req.params;

        if (!targetId) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const names = await News.findAll({ where: { targetId }, attributes: ['name'] });

        const uniqueNames = new Set(names.map((e) => e.name));

        const sortedNames = Array.from(uniqueNames).sort((a, b) => a.localeCompare(b));
        return res.status(200).json({ data: sortedNames, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const getAllNews = async (req, res) => {
    try {
        const { targetId } = req.params;

        if (!targetId) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const data = await News.findAll({
            where: { targetId },
        });

        const groupedData = {};

        data.forEach((item) => {
            const groupName = item.name;

            if (!groupedData[groupName]) {
                groupedData[groupName] = {
                    name: groupName,
                    items: [],
                    createdAt: item.createdAt,
                    updatedAt: item.updatedAt,
                };
            }

            groupedData[groupName].items.push({
                sort: item.sort,
                date: item.date,
                rate: item.rate,
                content: item.content,
                newsId: item.id,
                status: item.status,
                type: item.type,
                fromWhere: item.fromWhere,
            });
        });

        const result = Object.values(groupedData);

        result.forEach((group) => {
            group.items.sort((a, b) => a.sort - b.sort);
        });

        result.sort((a, b) => a.name.localeCompare(b.name));

        return res.status(200).json({ data: result, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const getNews = async (req, res) => {
    try {
        const { newsId } = req.params;

        if (!newsId) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }

        const data = await News.findOne({
            where: { id: newsId },
            include: [
                {
                    model: Tracking,
                },
            ],
        });

        return res.status(200).json({ data: data, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};
const updateNews = async (req, res) => {
    try {
        const { id } = req.params;

        const body = {
            sort: req.body.sort,
            name: req.body.name,
            date: req.body.date,
            rate: req.body.rate,
            content: req.body.content,
            status: req.body.status,
            type: req.body.type,
            fromWhere: req.body.fromWhere,
        };

        const [updated] = await News.update(body, {
            where: { id },
        });
        const data = await News.findOne({ where: { id } });
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

const deleteNews = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await News.destroy({
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
    createNews,
    getAllNews,
    getNews,
    updateNews,
    deleteNews,
    getAllNames,
};
