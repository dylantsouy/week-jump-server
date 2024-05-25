'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Observe extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Observe.belongsTo(models.Stock, {
                foreignKey: 'stockCode',
                onDelete: 'NO ACTION',
            });
            Observe.hasMany(models.ObservesRecord, {
                foreignKey: 'observeId',
                onUpdate: 'CASCADE',
            });
        }
    }
    Observe.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            initPrice: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            stockCode: {
                type: DataTypes.STRING,
                allowNull: false,
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'Observe',
        }
    );
    return Observe;
};
