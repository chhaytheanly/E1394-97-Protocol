import { LabonakService } from './services/labornak';
import { readFile } from 'fs/promises';

const read = async (filePath: string) => {
    try {
        const data = await readFile(filePath, 'utf-8');
        console.log('File read successfully');
        return data;
    } catch (error) {
        console.error('Error reading file:', error);
    }
};

const main = async () => {
    const data = await read('./data/raw.txt');
    
    if (!data){
        return console.error('No data to process');
    }

    const parser = new LabonakService();
    const report = parser.parse(data);
    console.log(JSON.stringify(report, null, 2));
}

main();