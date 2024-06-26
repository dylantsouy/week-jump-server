const { Admin } = require('../models');
const { errorHandler } = require('../helpers/responseHelper');
const config = require('../config/auth.config');

var jwt = require('jsonwebtoken');
var bcrypt = require('bcryptjs');

const signup = async (req, res) => {
    try {
        const { password, email, name } = req.body;
        if (!email || !password || !name) {
            return res.status(400).json({ message: 'please fill required field', success: false });
        }
        if (!/^[a-z0-9]{8,50}$/i.test(password))
            return res.status(400).json({ message: 'Validation is on password failed', success: false });
        req.body.password = bcrypt.hashSync(password, 8);

        await Admin.create(req.body);
        return res.status(200).json({ message: 'Successful Created', success: true });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const signin = async (req, res) => {
    try {
        const data = await Admin.findOne({
            where: {
                email: req.body.email,
            },
        });
        if (!data) {
            return res.status(400).send({ message: 'Email Error', success: false });
        }

        let passwordIsValid = bcrypt.compareSync(req.body.password, data.password);

        if (!passwordIsValid) {
            return res.status(401).send({
                token: null,
                message: 'Invalid Password',
                success: false,
            });
        }

        let token = jwt.sign({ id: data.id }, config.secret, {
            expiresIn: 86400, // 24 hours
        });

        await data.update({
            lastLoginAt: new Date(),
            loginCount: (data.loginCount || 0) + 1,
        });

        res.status(200).send({
            data: {
                id: data.id,
                email: data.email,
                role: data.role,
            },
            token,
            success: true,
        });
    } catch (error) {
        return res.status(500).json({ message: errorHandler(error), success: false });
    }
};

const getAllAdmins = async (req, res) => {
    try {
        const data = await Admin.findAll({
            attributes: { exclude: ['password'] },
        });
        return res.status(200).json({ data, success: true });
    } catch (error) {
        return res.status(500).send({ message: errorHandler(error), success: false });
    }
};

const updateAdmin = async (req, res) => {
    try {
        const { id } = req.params;

        const body = {
            email: req.body.email,
            role: req.body.role,
        };

        const [updated] = await Admin.update(body, {
            where: { id },
        });
        const data = await Admin.findOne({ where: { id }, attributes: { exclude: ['password'] } });
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

const updateAdminPassword = async (req, res) => {
    try {
        const { id } = req.params;
        if (!/^[a-z0-9]{8,50}$/i.test(req?.body?.password))
            return res.status(400).json({ message: 'Validation is on password failed', success: false });
        req.body.password = bcrypt.hashSync(req.body.password, 8);
        const body = { password: req.body.password };
        const [updated] = await Admin.update(body, {
            where: { id },
        });
        const data = await Admin.findOne({ where: { id }, attributes: { exclude: ['password'] } });
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

const deleteAdmin = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Admin.destroy({
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
    signup,
    signin,
    getAllAdmins,
    updateAdmin,
    deleteAdmin,
    updateAdminPassword,
};
