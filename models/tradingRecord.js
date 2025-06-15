'use strict';
const { Model } = require('sequelize');
module.exports = (sequelize, DataTypes) => {
    class TradingRecord extends Model {
        /**
         * Helper method for defining associations.
         * This method is not a part of Sequelize lifecycle.
         * The `models/index` file will call this method automatically.
         */
        static associate(models) {
            // TradingRecord belongs to Stock
            TradingRecord.belongsTo(models.Stock, {
                foreignKey: 'stockCode',
                targetKey: 'code',
                as: 'stock',
            });

            // TradingRecord belongs to BuyReason
            TradingRecord.belongsTo(models.BuyReason, {
                foreignKey: 'buyReasonId',
                as: 'buyReason',
            });

            // TradingRecord has many TradingRecordCheckLists (多對多關聯)
            TradingRecord.hasMany(models.TradingRecordCheckList, {
                foreignKey: 'tradingRecordId',
                as: 'checkLists',
            });

            // TradingRecord belongs to many CheckLists through TradingRecordCheckList
            TradingRecord.belongsToMany(models.CheckList, {
                through: models.TradingRecordCheckList,
                foreignKey: 'tradingRecordId',
                otherKey: 'checkListId',
                as: 'checkListItems',
            });
        }

        // 計算損益
        getProfitLoss() {
            if (!this.sellPrice || this.status === 'HOLDING') {
                return null;
            }
            return (this.sellPrice - this.buyPrice) * this.quantity;
        }

        // 計算損益率
        getProfitLossRate() {
            if (!this.sellPrice || this.status === 'HOLDING') {
                return null;
            }
            return ((this.sellPrice - this.buyPrice) / this.buyPrice) * 100;
        }

        // 計算總投資金額
        getTotalInvestment() {
            return this.buyPrice * this.quantity;
        }

        // 是否已賣出
        isSold() {
            return this.status === 'SOLD' || this.status === 'STOP_LOSS';
        }

        // 是否停損
        isStopLoss() {
            return this.status === 'STOP_LOSS';
        }
    }

    TradingRecord.init(
        {
            id: {
                type: DataTypes.UUID,
                primaryKey: true,
                allowNull: false,
            },
            stockCode: {
                type: DataTypes.STRING,
                allowNull: false,
                references: {
                    model: 'Stocks',
                    key: 'code',
                },
            },
            buyReasonId: {
                type: DataTypes.UUID,
                allowNull: false,
                references: {
                    model: 'BuyReasons',
                    key: 'id',
                },
            },
            buyPrice: {
                type: DataTypes.FLOAT,
                allowNull: false,
                validate: {
                    min: 0,
                },
            },
            quantity: {
                type: DataTypes.INTEGER,
                allowNull: false,
                validate: {
                    min: 1,
                },
            },
            stopLoss: {
                type: DataTypes.FLOAT,
                allowNull: false,
                comment: '停損點',
                validate: {
                    min: 0,
                },
            },
            targetPrice: {
                type: DataTypes.FLOAT,
                allowNull: false,
                comment: '滿足點',
                validate: {
                    min: 0,
                },
            },
            addPositionTrigger: {
                type: DataTypes.FLOAT,
                allowNull: true,
                comment: '加碼時機價格',
                validate: {
                    min: 0,
                },
            },
            addPositionCondition: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: '加碼條件描述',
            },
            emotion: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: '當時情緒狀態',
            },
            mistakes: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: '錯誤點分析',
            },
            result: {
                type: DataTypes.TEXT,
                allowNull: true,
                comment: '結果檢討',
            },
            status: {
                type: DataTypes.ENUM('HOLDING', 'SOLD', 'STOP_LOSS'),
                defaultValue: 'HOLDING',
                allowNull: false,
            },
            sellPrice: {
                type: DataTypes.FLOAT,
                allowNull: true,
                comment: '賣出價格',
                validate: {
                    min: 0,
                },
            },
            sellDate: {
                type: DataTypes.DATE,
                allowNull: true,
                comment: '賣出日期',
            },
        },
        {
            charset: 'utf8',
            collate: 'utf8_general_ci',
            sequelize,
            paranoid: true,
            modelName: 'TradingRecord',
            hooks: {
                // 在賣出時自動設定賣出日期
                beforeUpdate: (record, options) => {
                    if (
                        record.changed('status') &&
                        (record.status === 'SOLD' || record.status === 'STOP_LOSS') &&
                        !record.sellDate
                    ) {
                        record.sellDate = new Date();
                    }
                },
            },
        }
    );
    return TradingRecord;
};
