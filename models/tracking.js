'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class Tracking extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            Tracking.belongsTo(models.News, {
                foreignKey: 'newsId',
                onDelete: 'CASCADE',
            });
        }
    }
    Tracking.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            sort:{
                allowNull: false,
                type: DataTypes.INTEGER,
            },
            date:{
                allowNull: false,
                type: DataTypes.DATE,
            },
            content:{
                allowNull: true,
                type: DataTypes.TEXT,
            },
            fromWhere: {
                allowNull: true,
                type: DataTypes.STRING,
            },
            type: {
                allowNull: false,
                type: DataTypes.INTEGER,
                defaultValue: 1,
                comment:
                    '1: 利多, 2: 利空, 3: 中立',
            },
            newsId: {
                type: DataTypes.UUID,
                validate: {
                    notEmpty: true,
                },
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'Tracking',
        }
    );
    return Tracking;
};
