/**
 * 操作类型枚举
 */
const OperationType = Object.freeze({
    DESC: 1,
    TEXT: 2,
    CONTAINS: 3,
    ID: 4,
    CLASS_NAME: 5
});

// 重试时间(分钟)
const retry_time = 1;

/**
 * 自动超时查找元素
 * @param {操作类型} type 
 * @param {关键字} keyWord 
 * @returns 
 */
function $(type, keyWord){
    let ele = undefined;
    let findCount = 0;
    while(true){
        switch(type){
            case OperationType.DESC:
                ele = desc(keyWord).findOne(1000);
                break;
            case OperationType.TEXT:
                ele = text(keyWord).findOne(1000);
                break;
            case OperationType.CONTAINS:
                ele = textContains(keyWord).findOne(1000);
                break;
            case OperationType.ID:
                ele = textContains(keyWord).findOne(1000);
                break;
            case OperationType.CLASS_NAME:
                sleep(1000);
                ele = className(keyWord).find();
                break;
        }
        if(ele){
            return ele;
        }else{
            findCount ++;
            if(findCount >= retry_time * 60){
                toast("在"+retry_time+"分钟内未查找到该内容【"+ keyWord +"】的元素");
                return;
            }else{
                console.log('正在重试获取,获取次数:', findCount);
            }
        }
    }
}
