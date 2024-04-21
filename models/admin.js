'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Admin extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
        }
    }
    Admin.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            email: {
                type: DataTypes.STRING,
                validate: {
                    notEmpty: true,
                    isEmail: true,
                },
            },
            password: {
                type: DataTypes.STRING,
                validate: {
                    notEmpty: true,
                },
            },
            name: {
                type: DataTypes.STRING,
                validate: {
                    notEmpty: true,
                },
            },
            role: {
                allowNull: false,
                type: DataTypes.INTEGER,
                defaultValue: 3,
                comment: '1: manager, 2: editor, 3: viewer',
            },
            lastLoginAt: {
                type: DataTypes.DATE,
                defaultValue: null,
            },
            loginCount: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'Admin',
        }
    );
    return Admin;
};
