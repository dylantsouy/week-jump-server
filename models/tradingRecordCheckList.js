'use strict';
const { Model } = require('sequelize');

module.exports = (sequelize, DataTypes) => {
    class TradingRecordCheckList extends Model {
        static associate(models) {
            // TradingRecordCheckList belongs to TradingRecord
            TradingRecordCheckList.belongsTo(models.TradingRecord, {
                foreignKey: 'tradingRecordId',
                as: 'tradingRecord',
            });

            // TradingRecordCheckList belongs to CheckList
            TradingRecordCheckList.belongsTo(models.CheckList, {
                foreignKey: 'checkListId',
                as: 'checkList',
            });
        }
    }

    TradingRecordCheckList.init(
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
            },
            tradingRecordId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'TradingRecords',
                    key: 'id',
                },
            },
            checkListId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'CheckLists',
                    key: 'id',
                },
            },
            isChecked: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
            },
            notes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: '針對此項目的備註',
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            modelName: 'TradingRecordCheckList',
            timestamps: true,
            paranoid: false, // 這個關聯表不需要軟刪除
            indexes: [
                {
                    fields: ['tradingRecordId'],
                },
                {
                    fields: ['checkListId'],
                },
                {
                    fields: ['tradingRecordId', 'checkListId'],
                    unique: true,
                    name: 'unique_trading_record_checklist',
                },
            ],
        }
    );

    return TradingRecordCheckList;
};
