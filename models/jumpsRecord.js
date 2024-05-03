'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class JumpsRecord extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            JumpsRecord.belongsTo(models.Jump, {
                foreignKey: 'jumpId',
                onDelete: 'CASCADE',
            });
        }
    }
    JumpsRecord.init(
        {
            id: {
                type: DataTypes.UUID,
                defaultValue: DataTypes.UUIDV4,
                allowNull: false,
                primaryKey: true,
                unique: true,
            },
            type: {
                type: DataTypes.ENUM,
                values: ['d', 'w', 'm'],
                defaultValue: 'd',
                allowNull: false,
                comment: 'd: 日跳, w: 周跳, m: 月跳',
            },
            price: {
                allowNull: false,
                type: DataTypes.FLOAT,
            },
            closed: {
                allowNull: false,
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            date: {
                allowNull: false,
                type: DataTypes.STRING,
            },
            jumpId: {
                allowNull: false,
                type: DataTypes.UUID,
                onDelete: 'CASCADE',
                references: {
                    model: 'Jumps',
                    key: 'id',
                    as: 'jumpId',
                },
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'JumpsRecord',
        }
    );
    return JumpsRecord;
};
