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
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            stockCode: {
                type: DataTypes.STRING,
                allowNull: false,
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
            initPrice: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
                allowNull: false,
            },
            marginRate: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
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