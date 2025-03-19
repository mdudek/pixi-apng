export function getFileExtension(filePath: string) {
    let aList = filePath.split('.');
    return aList[aList.length - 1];
}
