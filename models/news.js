'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class News extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            News.belongsTo(models.Target, {
                foreignKey: 'targetId',
                onDelete: 'CASCADE',
            });
        }
    }
    News.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            sort: {
                allowNull: false,
                type: DataTypes.INTEGER,
            },
            name: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            date: {
                allowNull: false,
                type: DataTypes.DATE,
            },
            content: {
                allowNull: true,
                type: DataTypes.TEXT,
            },
            fromWhere: {
                allowNull: true,
                type: DataTypes.STRING,
            },
            rate:{
                allowNull: false,
                type: DataTypes.INTEGER,
                defaultValue: 1,
            },
            type: {
                allowNull: false,
                type: DataTypes.INTEGER,
                defaultValue: 1,
                comment: '1: 利多, 2: 利空, 3: 中立',
            },
            status: {
                allowNull: false,
                type: DataTypes.INTEGER,
                defaultValue: 1,
                comment:
                    '1: 時間未到, 2: 提前完成, 3: 準時完成, 4:延後完成 , 5: 延後未完, 6: 狀況不明, 7: 悲觀延後, 8: 樂觀準時, 9: 無時效性',
            },
            targetId: {
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
            modelName: 'News',
        }
    );
    return News;
};
