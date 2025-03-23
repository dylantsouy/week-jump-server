'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Loan extends Model {
        static associate(models) {
            Loan.belongsTo(models.Stock, {
                foreignKey: 'stockCode',
                targetKey: 'code',
                onUpdate: "NO ACTION",
                onDelete: 'NO ACTION',
            });
        }
    }
    Loan.init(
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            stockCode: {
                type: DataTypes.STRING,
                allowNull: false,
                references: {
                    model: 'Stocks',
                    key: 'code'
                }
            },
            previousBalance: {
                type: DataTypes.BIGINT,
                allowNull: false,
            },
            currentBalance: {
                type: DataTypes.BIGINT,
                allowNull: false,
            },
            change: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            recordDate: {
                type: DataTypes.DATE,
                allowNull: false,
            }
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: false,
            modelName: 'Loan',
        }
    );
    return Loan;
};