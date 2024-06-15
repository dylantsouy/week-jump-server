'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Stock extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Stock.hasMany(models.Target, {
                foreignKey: 'stockCode',
                onUpdate: "NO ACTION",
                onDelete: 'NO ACTION',
            });
            Stock.hasMany(models.ContractsRecord, {
                foreignKey: 'stockCode',
                onUpdate: "NO ACTION",
                onDelete: 'NO ACTION',
            });
        }
    }
    Stock.init(
        {
            code: {
                type: DataTypes.STRING,
                primaryKey: true,
                unique: true,
                allowNull: false,
            },
            name: {
                type: DataTypes.STRING,
                validate: {
                    notEmpty: true,
                },
            },
            industry: {
                type: DataTypes.STRING,
                validate: {
                    notEmpty: true,
                },
            },
            price: {
                type: DataTypes.STRING,
                validate: {
                    notEmpty: true,
                },
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: false,
            modelName: 'Stock',
        }
    );
    return Stock;
};
