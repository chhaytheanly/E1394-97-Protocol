import { LabonakService } from './services/labornak';
import { analyzerRegistry } from './lib/parsers/parserRegistry';
import { referenceValidator } from './lib/validators/references';
import { HIPAACompliance, DataIntegrityService, encryption } from './lib/security/auth';
import { logger } from './lib/logger/logger';
import { db } from './services/queryService';

const rawData = `H|\\^&|    XN-330^00-22^15985^^^^CX851950||E1394-97
P|1|LMB-TEST-001|^^|M|^||||^^^
C|1||
O|1^^                     9^M|^^^^WBC\\^^^^RBC\\^^^^HGB\\^^^^HCT\\^^^^MCV\\^^^^MCH\\^^^^MCHC\\^^^^PLT\\^^^^RDW-SD\\^^^^RDW-CV\\^^^^PDW\\^^^^MPV\\^^^^P-LCR\\^^^^PCT\\^^^^NEUT#\\^^^^LYMPH#\\^^^^MONO#\\^^^^EO#\\^^^^BASO#\\^^^^NEUT%\\^^^^LYMPH%\\^^^^MONO%\\^^^^EO%\\^^^^BASO%\\^^^^IG#\\^^^^IG%\\^^^^MICROR\\^^^^MACROR\\^^^^OPEN|N||||||F
C|1||
R|1|^^^^WBC^1|7.84|10*3/uLNF||||20260509101530
R|2|^^^^RBC^1|4.91|10*6/uLNF||||20260509101530
R|3|^^^^HGB^1|13.8|g/dLNF||||20260509101530
R|4|^^^^HCT^1|40.7|%NF||||20260509101530
R|5|^^^^MCV^1|82.9|fLLF||||20260509101530
R|6|^^^^MCH^1|28.1|pgNF||||20260509101530
R|7|^^^^MCHC^1|33.9|g/dLNF||||20260509101530
R|8|^^^^PLT^1|245|10*3/uLNF||||20260509101530
R|9|^^^^NEUT%^1|51.2|%NF||||20260509101530
R|10|^^^^LYMPH%^1|38.6|%NF||||20260509101530
R|11|^^^^MONO%^1|7.4|%NF||||20260509101530
R|12|^^^^EO%^1|2.5|%NF||||20260509101530
R|13|^^^^BASO%^1|0.3|%NF||||20260509101530
R|14|^^^^NEUT#^1|4.01|10*3/uLNF||||20260509101530
R|15|^^^^LYMPH#^1|3.03|10*3/uLNF||||20260509101530
R|16|^^^^MONO#^1|0.58|10*3/uLNF||||20260509101530
R|17|^^^^EO#^1|0.20|10*3/uLNF||||20260509101530
R|18|^^^^BASO#^1|0.02|10*3/uLNF||||20260509101530
R|19|^^^^IG%^1|0.1|%NF||||20260509101530
R|20|^^^^IG#^1|0.01|10*3/uLNF||||20260509101530
R|21|^^^^RDW-SD^1|35.1|fLLF||||20260509101530
R|22|^^^^RDW-CV^1|11.9|%NF||||20260509101530
R|23|^^^^MICROR^1|2.1|%NF||||20260509101530
R|24|^^^^MACROR^1|4.8|%NF||||20260509101530
R|25|^^^^PDW^1|11.6|fLNF||||20260509101530
R|26|^^^^MPV^1|10.4|fLNF||||20260509101530
R|27|^^^^P-LCR^1|29.7|%NF||||20260509101530
R|28|^^^^PCT^1|0.25|%NF||||20260509101530
R|29|^^^^Blasts/Abn_Lympho?|0|F||||20260509101530
R|30|^^^^Left_Shift?|0|F||||20260509101530
R|31|^^^^Atypical_Lympho?|0|F||||20260509101530
R|32|^^^^NRBC?|0|F||||20260509101530
R|33|^^^^RBC_Agglutination?|0|F||||20260509101530
R|34|^^^^Turbidity/HGB_Interference?|0|F||||20260509101530
R|35|^^^^Iron_Deficiency?|0|F||||20260509101530
R|36|^^^^HGB_Defect?|0|F||||20260509101530
R|37|^^^^Fragments?|0|F||||20260509101530
R|38|^^^^PLT_Clumps?|0|F||||20260509101530
R|39|^^^^SCAT_WDF|PNG&R&20260509&R&2026_05_09_10_15_30_WDF.PNG|NF||||20260509101530
R|40|^^^^SCAT_WDF-CBC|PNG&R&20260509&R&2026_05_09_10_15_30_WDF_CBC.PNG|NF||||20260509101530
R|41|^^^^DIST_RBC|PNG&R&20260509&R&2026_05_09_10_15_30_RBC.PNG|NF||||20260509101530
R|42|^^^^DIST_PLT|PNG&R&20260509&R&2026_05_09_10_15_30_PLT.PNG|NF||||20260509101530
C|1||
L|1|N
`;

const parser = new LabonakService();
const report = parser.parse(rawData);
console.log(JSON.stringify(report, null, 2));
