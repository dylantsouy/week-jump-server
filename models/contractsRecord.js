'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class ContractsRecord extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            ContractsRecord.belongsTo(models.Stock, {
                foreignKey: 'stockCode',
                onDelete: 'NO ACTION',
            });
        }
    }
    ContractsRecord.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            percentage: {
                allowNull: false,
                type: DataTypes.FLOAT,
            },
            contractValue: {
                allowNull: false,
                type: DataTypes.FLOAT,
            },
            qoq: {
                allowNull: false,
                type: DataTypes.FLOAT,
            },
            yoy: {
                allowNull: false,
                type: DataTypes.FLOAT,
            },
            quarter: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            stockCode: {
                allowNull: false,
                type: DataTypes.UUID,
                onDelete: 'CASCADE',
                references: {
                    model: 'Stocks',
                    key: 'id',
                    as: 'stockCode',
                },
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'ContractsRecord',
        }
    );
    return ContractsRecord;
};
