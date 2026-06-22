#!/usr/bin/env node
'use strict';

/**
 * Generate relational-ready seed data for the CookSmart schema.
 * Outputs dataset.json and dataset.xlsx (multi-sheet) under Data/output/.
 */

const fs = require('fs');
const path = require('path');

let XLSX;
try {
  XLSX = require('xlsx');
} catch (err) {
  console.error('Missing dependency "xlsx". Install with `npm install` before running this tool.');
  process.exit(1);
}

const randomChoice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const formatDate = (date) => date.toISOString().slice(0, 19).replace('T', ' ');
const addMinutes = (date, minutes) => {
  const d = new Date(date.getTime());
  d.setMinutes(d.getMinutes() + minutes);
  return d;
};

const idCounters = new Map();
const nextId = (key) => {
  const current = idCounters.get(key) ?? 0;
  const next = current + 1;
  idCounters.set(key, next);
  return next;
};

const fakeHash = (label) => {
  const base = Buffer.from(label).toString('base64').replace(/[^a-zA-Z0-9]/g, '');
  const padded = (base + 'abcdefghijklmnopqrstuvwxzyABCDEFGHIJKLMNOPQRSTUVWXZY0123456789').slice(0, 53);
  return `$2b$12$${padded}`;
};

const now = new Date('2024-10-01T08:00:00Z');
let timestampCursor = now;
const nextTimestamp = () => {
  timestampCursor = addMinutes(timestampCursor, randomInt(30, 960));
  const formatted = formatDate(timestampCursor);
  return { created_at: formatted, updated_at: formatted };
};

const ingredientCategoryCatalog = [
  {
    slug: 'poultry',
    name_vi: 'Gia cầm',
    name_en: 'Poultry',
    description: 'Các loại thịt gia cầm như gà, vịt, ngan với chất lượng tươi ngon cho món áp chảo, nướng hoặc hầm.'
  },
  {
    slug: 'beef_lamb',
    name_vi: 'Thịt bò & cừu',
    name_en: 'Beef & Lamb',
    description: 'Nhóm thịt đỏ giàu đạm với kết cấu chắc, phù hợp món nướng, hầm và steak.'
  },
  {
    slug: 'pork',
    name_vi: 'Thịt heo',
    name_en: 'Pork',
    description: 'Các phần thịt heo phổ biến cho món kho, nướng, chiên và chế biến giò chả.'
  },
  {
    slug: 'seafood_fish',
    name_vi: 'Hải sản - Cá',
    name_en: 'Seafood - Fish',
    description: 'Cá phi lê và cá nguyên con nhiều omega-3 cho món hấp, nướng, áp chảo.'
  },
  {
    slug: 'seafood_shellfish',
    name_vi: 'Hải sản - Giáp xác & Nhuyễn thể',
    name_en: 'Seafood - Shellfish',
    description: 'Tôm, cua, mực, sò tươi ngọt dành cho món hấp, xào, lẩu.'
  },
  {
    slug: 'plant_protein',
    name_vi: 'Đạm thực vật',
    name_en: 'Plant Proteins',
    description: 'Các nguyên liệu giàu đạm từ thực vật như đậu phụ, tempeh, seitan.'
  },
  {
    slug: 'leafy_greens',
    name_vi: 'Rau lá',
    name_en: 'Leafy Greens',
    description: 'Rau xanh giàu chất xơ và vitamin dùng cho salad, xào hoặc canh.'
  },
  {
    slug: 'root_stem',
    name_vi: 'Củ & Thân',
    name_en: 'Roots & Stems',
    description: 'Rau củ dạng củ, thân giòn ngọt hỗ trợ món kho, hầm và salad.'
  },
  {
    slug: 'fruit_vegetables',
    name_vi: 'Rau quả',
    name_en: 'Fruit Vegetables',
    description: 'Các loại quả ăn như rau với màu sắc bắt mắt và vị ngọt dịu.'
  },
  {
    slug: 'mushrooms',
    name_vi: 'Nấm',
    name_en: 'Mushrooms',
    description: 'Đa dạng nấm tươi và khô tăng umami cho món chay lẫn mặn.'
  },
  {
    slug: 'aromatics',
    name_vi: 'Gia vị tươi',
    name_en: 'Fresh Aromatics',
    description: 'Những nguyên liệu thơm đặc trưng như hành, tỏi, gừng, sả.'
  },
  {
    slug: 'spices_seasonings',
    name_vi: 'Gia vị khô',
    name_en: 'Dry Spices',
    description: 'Bột và hạt gia vị dùng ướp, nêm tạo chiều sâu hương vị.'
  },
  {
    slug: 'fermented_condiments',
    name_vi: 'Đồ lên men & Nước chấm',
    name_en: 'Fermented Condiments',
    description: 'Nước mắm, tương, sốt lên men và kim chi cho món ăn đậm đà.'
  },
  {
    slug: 'grains_rice',
    name_vi: 'Gạo & Ngũ cốc',
    name_en: 'Rice & Grains',
    description: 'Nguồn tinh bột đa dạng như gạo, yến mạch, quinoa.'
  },
  {
    slug: 'noodles_pasta',
    name_vi: 'Mì & Bún',
    name_en: 'Noodles & Pasta',
    description: 'Các loại sợi mì Á - Âu sử dụng cho món xào, nước, salad.'
  },
  {
    slug: 'legumes_pulses',
    name_vi: 'Đậu & Đỗ',
    name_en: 'Legumes & Pulses',
    description: 'Đa dạng hạt họ đậu giàu protein, chất xơ cho món chay và súp.'
  },
  {
    slug: 'nuts_seeds',
    name_vi: 'Hạt & Quả khô',
    name_en: 'Nuts & Seeds',
    description: 'Hạt béo, quả sấy khô bổ sung năng lượng, topping salad và món tráng miệng.'
  },
  {
    slug: 'dairy_eggs',
    name_vi: 'Sữa & Trứng',
    name_en: 'Dairy & Eggs',
    description: 'Sản phẩm từ sữa và trứng giúp tăng độ béo mịn, tạo kết cấu cho món ăn.'
  },
  {
    slug: 'oils_fats',
    name_vi: 'Dầu & Chất béo',
    name_en: 'Oils & Fats',
    description: 'Các loại dầu thực vật, mỡ động vật và bơ dùng chiên, áp chảo hoặc làm sốt.'
  },
  {
    slug: 'sweeteners',
    name_vi: 'Chất tạo ngọt',
    name_en: 'Sweeteners',
    description: 'Đường, mật và si rô tự nhiên cho món tráng miệng, sốt glaze.'
  },
  {
    slug: 'stocks_broths',
    name_vi: 'Nước dùng & Lẩu',
    name_en: 'Stocks & Broths',
    description: 'Nước dùng nền tảng tạo vị ngọt thanh cho món canh, lẩu, risotto.'
  },
  {
    slug: 'dried_goods',
    name_vi: 'Đồ khô & Thảo mộc',
    name_en: 'Dried Goods',
    description: 'Nguyên liệu sấy, phơi khô dễ bảo quản như tôm khô, rong biển, trà hoa.'
  }
];

const ingredientCatalogGroups = [
  {
    category: 'poultry',
    items: [
      {
        name_vi: 'Ức gà',
        name_en: 'Chicken breast',
        aliases: ['Lườn gà'],
        description: 'Phần thịt nạc ít mỡ, màu hồng nhạt.',
        usage: 'Phù hợp món áp chảo, nướng lò, salad hoặc xé phay.',
        storage: 'Bảo quản 0-4°C tối đa 48 giờ hoặc đông sâu -18°C trong 3 tháng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đùi gà',
        name_en: 'Chicken thigh',
        description: 'Thịt mềm, nhiều mỡ và collagen cho món kho, chiên giòn.',
        usage: 'Thích hợp kho tộ, nướng mật ong, chiên nước mắm.',
        storage: 'Để ngăn mát trong 2 ngày hoặc cấp đông 3 tháng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cánh gà',
        name_en: 'Chicken wing',
        description: 'Phần cánh gà có da giòn, thịt ngọt.',
        usage: 'Ưa dùng cho món nướng BBQ, chiên mắm, sốt cay.',
        storage: 'Bọc kín, giữ lạnh 0-2°C trong 36 giờ hoặc đông lạnh 90 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Gà ta nguyên con',
        name_en: 'Free-range whole chicken',
        description: 'Gà nuôi thả vườn thịt săn chắc, hương vị đậm.',
        usage: 'Luộc, quay hoặc hầm thuốc bắc.',
        storage: 'Bảo quản lạnh 0-2°C và chế biến trong 24 giờ.',
        default_unit: 'con'
      },
      {
        name_vi: 'Ức vịt',
        name_en: 'Duck breast',
        description: 'Thịt vịt đỏ sẫm, lớp mỡ dày.',
        usage: 'Áp chảo kiểu Pháp, nướng lò kèm sốt trái cây.',
        storage: 'Làm sạch, hút chân không và lạnh 0°C tối đa 48 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đùi vịt',
        name_en: 'Duck leg',
        description: 'Đùi vịt chắc thịt, giàu chất béo.',
        usage: 'Kho gừng, om cam hoặc confit truyền thống.',
        storage: 'Bảo quản 0-2°C dùng trong 2 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thịt ngan phi lê',
        name_en: 'Boneless muscovy duck',
        description: 'Thịt ngan đỏ sẫm, ít mùi hôi.',
        usage: 'Áp chảo, xào sả ớt, nấu miến.',
        storage: 'Che phủ, giữ lạnh 0-4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Gan gà',
        name_en: 'Chicken liver',
        description: 'Gan gà tươi màu nâu, béo ngậy.',
        usage: 'Làm pate, xào chua ngọt, phi lê nướng.',
        storage: 'Ngâm sữa lạnh, bảo quản 0-2°C và dùng trong 24 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Trứng gà ta',
        name_en: 'Free-range chicken egg',
        description: 'Lòng đỏ béo, lòng trắng dai nhẹ.',
        usage: 'Làm bánh, món hấp, sốt mayonnaise thủ công.',
        storage: 'Để nơi thoáng mát hoặc ngăn mát 7-10 ngày.',
        default_unit: 'quả'
      },
      {
        name_vi: 'Trứng vịt',
        name_en: 'Duck egg',
        description: 'Trứng vịt to, đậm mùi hơn trứng gà.',
        usage: 'Làm sốt trứng muối, chiên la-cốp, muối chín.',
        storage: 'Giữ lạnh 4°C dùng trong 10 ngày.',
        default_unit: 'quả'
      }
    ]
  },
  {
    category: 'beef_lamb',
    items: [
      {
        name_vi: 'Thăn nội bò',
        name_en: 'Beef tenderloin',
        aliases: ['Phi lê bò'],
        description: 'Phần thịt mềm nhất, ít mỡ.',
        usage: 'Steak tái, nướng, áp chảo bơ tỏi.',
        storage: 'Hút chân không, lạnh -1°C đến 1°C dùng 3 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thăn ngoại bò',
        name_en: 'Striploin steak',
        description: 'Có lớp mỡ viền cho mùi thơm đặc trưng.',
        usage: 'Grill medium rare, roast nguyên khối.',
        storage: 'Giữ lạnh 0-2°C và dùng trong 72 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thịt bắp bò',
        name_en: 'Beef shank',
        description: 'Thớ thịt dai, nhiều gân.',
        usage: 'Hầm rượu vang, phở bò, kho gừng.',
        storage: 'Bảo quản 0-4°C, nấu trong 48 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thịt gân bò',
        name_en: 'Beef tendon',
        description: 'Gân trắng giòn dai sau khi hầm.',
        usage: 'Lẩu gân bò, hầm thuốc bắc.',
        storage: 'Đông lạnh -18°C, rã đông chậm trước khi nấu.',
        default_unit: 'g'
      },
      {
        name_vi: 'Sườn bò chữ T',
        name_en: 'T-bone steak',
        description: 'Kết hợp thăn nội và thăn ngoại trên xương chữ T.',
        usage: 'Thích hợp nướng than, áp chảo bơ thảo mộc.',
        storage: 'Giữ lạnh 0-2°C sử dụng trong 48 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thịt bò xay 85/15',
        name_en: 'Ground beef 85/15',
        description: 'Tỷ lệ nạc 85%, mỡ 15% cân bằng vị ngọt.',
        usage: 'Làm burger, sốt bolognese, xíu mại.',
        storage: 'Bảo quản lạnh 0-2°C tối đa 24 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thịt cừu vai',
        name_en: 'Lamb shoulder',
        description: 'Thịt cừu nhiều mỡ, thơm mùi thảo mộc tự nhiên.',
        usage: 'Nướng gia vị Địa Trung Hải, hầm rượu vang.',
        storage: 'Đông lạnh -18°C, rã đông trong tủ mát trước khi dùng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Sườn cừu Pháp',
        name_en: 'French rack of lamb',
        description: 'Phần sườn được lóc sạch thịt thừa, trình bày đẹp.',
        usage: 'Nướng lò, áp chảo butter baste, phủ sốt rượu.',
        storage: 'Giữ lạnh 0-2°C và dùng trong 48 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thịt dê thăn lưng',
        name_en: 'Goat loin',
        description: 'Thịt dê non, ít mỡ, vị ngọt nhẹ.',
        usage: 'Nướng mọi, xào lăn, làm lẩu.',
        storage: 'Đông lạnh hoặc giữ lạnh 0-2°C dùng trong 36 giờ.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'pork',
    items: [
      {
        name_vi: 'Thịt heo ba chỉ',
        name_en: 'Pork belly',
        description: 'Ba chỉ nhiều lớp mỡ và nạc xen kẽ.',
        usage: 'Kho tàu, nướng Hàn Quốc, rim nước mắm.',
        storage: 'Bảo quản 0-4°C tối đa 48 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thịt heo nạc vai',
        name_en: 'Pork shoulder butt',
        description: 'Thớ thịt mềm, chứa chút mỡ.',
        usage: 'Xay làm chả, nướng xá xíu, om tiêu.',
        storage: 'Giữ lạnh 0-2°C sử dụng trong 2 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Sườn non heo',
        name_en: 'Pork spare ribs',
        description: 'Sườn có sụn mềm, thịt ngọt.',
        usage: 'Nướng mật ong, rim me, nấu canh chua.',
        storage: 'Đông lạnh -18°C hoặc mát 0-2°C 36 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thịt heo mông',
        name_en: 'Pork ham',
        description: 'Thịt nạc săn chắc, ít mỡ.',
        usage: 'Luộc thái lát, làm giò thủ, áp chảo.',
        storage: 'Bảo quản lạnh 0-2°C dùng trong 48 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Thịt heo xay 80/20',
        name_en: 'Ground pork 80/20',
        description: 'Tỷ lệ nạc 80%, mỡ 20% tạo độ mềm mọng.',
        usage: 'Chả lá lốt, há cảo, nhân bánh bao.',
        storage: 'Bảo quản 0-2°C dùng trong 24 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Tim heo',
        name_en: 'Pork heart',
        description: 'Cơ tim săn chắc, vị ngọt tự nhiên.',
        usage: 'Xào hành tây, hầm thuốc bắc, nướng sate.',
        storage: 'Rửa sạch, ngâm nước muối và lạnh 0-2°C 24 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Gan heo',
        name_en: 'Pork liver',
        description: 'Gan đậm vị, giàu sắt.',
        usage: 'Làm pate, xào giá hẹ, hấp hành gừng.',
        storage: 'Ngâm sữa, bảo quản 0°C và dùng trong ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Lưỡi heo',
        name_en: 'Pork tongue',
        description: 'Lưỡi giòn mềm khi hầm hoặc áp chảo.',
        usage: 'Luộc thái mỏng trộn gỏi, áp chảo sốt tiêu.',
        storage: 'Đông lạnh hoặc để 0-2°C trong 2 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Chân giò heo',
        name_en: 'Pork hock',
        description: 'Kết cấu nhiều gân, da giòn.',
        usage: 'Kho măng, hầm đậu, muối chiên giòn.',
        storage: 'Giữ lạnh 0-2°C tối đa 48 giờ.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'seafood_fish',
    items: [
      {
        name_vi: 'Cá hồi phi lê',
        name_en: 'Salmon fillet',
        description: 'Thịt cam, nhiều omega-3, da giòn.',
        usage: 'Áp chảo, sashimi, nướng giấy bạc.',
        storage: 'Bảo quản 0°C và dùng trong 24 giờ hoặc đông lạnh 3 tháng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cá ngừ đại dương',
        name_en: 'Yellowfin tuna loin',
        description: 'Thịt đỏ, chắc, thích hợp ăn sống.',
        usage: 'Tataki, poke, steak áp chảo.',
        storage: 'Giữ lạnh 0°C, nên dùng trong 24 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cá thu cắt khúc',
        name_en: 'Mackerel steak',
        description: 'Thịt cá béo, thơm, giàu DHA.',
        usage: 'Nướng muối ớt, kho nghệ, rim tiêu.',
        storage: 'Bảo quản 0-2°C và dùng trong 36 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cá chẽm phi lê',
        name_en: 'Barramundi fillet',
        description: 'Thịt trắng, ít xương dăm, vị ngọt.',
        usage: 'Hấp xì dầu, áp chảo vỏ giòn.',
        storage: 'Giữ lạnh 0°C, dùng trong 2 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cá basa phi lê',
        name_en: 'Pangasius fillet',
        description: 'Thịt trắng mềm, ít xương, dễ chế biến.',
        usage: 'Kho tộ, nấu canh chua, chiên xù.',
        storage: 'Đông lạnh nhanh -18°C, rã đông từ từ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cá rô phi phi lê',
        name_en: 'Tilapia fillet',
        description: 'Thịt trắng nạc, ít tanh.',
        usage: 'Chiên xù, sốt bơ chanh, nướng giấy bạc.',
        storage: 'Bọc kín, bảo quản 0-2°C 36 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cá diêu hồng nguyên con',
        name_en: 'Red tilapia whole',
        description: 'Thịt ngọt, da đỏ đẹp.',
        usage: 'Hấp Hong Kong, chiên xù sốt me.',
        storage: 'Giữ lạnh đá vảy 0°C dùng trong 24 giờ.',
        default_unit: 'con'
      },
      {
        name_vi: 'Cá trích phi lê',
        name_en: 'Herring fillet',
        description: 'Thịt cá béo, có thể làm gỏi.',
        usage: 'Gỏi cuốn, sốt mù tạt, nướng than.',
        storage: 'Giữ lạnh 0°C, dùng trong 24 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cá mòi đóng hộp',
        name_en: 'Sardine in oil',
        description: 'Cá mòi ngâm dầu ô liu, tiện dùng.',
        usage: 'Salad, spaghetti, sandwich nóng.',
        storage: 'Để nhiệt độ phòng <30°C, mở lon bảo quản mát.',
        default_unit: 'lon'
      }
    ]
  },
  {
    category: 'seafood_shellfish',
    items: [
      {
        name_vi: 'Tôm sú tươi',
        name_en: 'Black tiger prawn',
        description: 'Tôm vỏ dày, thịt chắc, ngọt.',
        usage: 'Hấp bia, nướng phô mai, xào bơ tỏi.',
        storage: 'Giữ lạnh 0°C với đá vảy, dùng trong 24 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Tôm thẻ chân trắng',
        name_en: 'Whiteleg shrimp',
        description: 'Tôm nhỏ hơn tôm sú, vỏ mỏng, dễ bóc.',
        usage: 'Luộc, trộn gỏi, nấu canh chua.',
        storage: 'Đông lạnh nhanh hoặc giữ mát 0-2°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Tôm hùm baby',
        name_en: 'Baby lobster',
        description: 'Thịt tôm hùm ngọt, vỏ mỏng.',
        usage: 'Nướng bơ tỏi, hấp rượu vang, lẩu.',
        storage: 'Bảo quản sống trong bể mặn hoặc đá lạnh ướp muối.',
        default_unit: 'con'
      },
      {
        name_vi: 'Mực ống tươi',
        name_en: 'Squid tube',
        description: 'Mực ống trắng, giòn, ít tanh.',
        usage: 'Nhồi thịt hấp, chiên giòn, nướng sa tế.',
        storage: 'Giữ lạnh 0°C, dùng trong 24 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Mực lá',
        name_en: 'Cuttlefish',
        description: 'Thịt dày, giòn, nhiều dinh dưỡng.',
        usage: 'Nướng mọi, xào cần tỏi, nấu cháo.',
        storage: 'Đông lạnh -18°C hoặc ướp đá vảy.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bạch tuộc baby',
        name_en: 'Baby octopus',
        description: 'Xúc tua nhỏ, giòn, dễ tẩm ướp.',
        usage: 'Nướng sa tế, trộn salad kiểu Thái.',
        storage: 'Bảo quản 0°C, dùng trong 24 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Ngao hai cồi',
        name_en: 'Hard clam',
        description: 'Ngao thịt trắng, giàu khoáng chất.',
        usage: 'Hấp sả, nấu cháo, nấu canh chua.',
        storage: 'Ngâm nước muối loãng, giữ mát 4°C.',
        default_unit: 'kg'
      },
      {
        name_vi: 'Sò điệp Nhật',
        name_en: 'Hokkaido scallop',
        description: 'Thớ thịt dày, ngọt, thơm bơ.',
        usage: 'Áp chảo, sashimi, nướng phô mai.',
        storage: 'Giữ lạnh -1°C đến 1°C, dùng trong 48 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hàu sữa',
        name_en: 'Pacific oyster',
        description: 'Hàu tươi, béo, giàu kẽm.',
        usage: 'Ăn sống, nướng mỡ hành, lẩu hàu.',
        storage: 'Để trên đá ướp muối, dùng trong 24 giờ.',
        default_unit: 'con'
      },
      {
        name_vi: 'Ghẹ xanh',
        name_en: 'Blue swimmer crab',
        description: 'Ghẹ thịt chắc, vị ngọt tự nhiên.',
        usage: 'Hấp bia, rang me, nấu cháo ghẹ.',
        storage: 'Buộc dây, giữ sống trên đá lạnh 0°C.',
        default_unit: 'con'
      },
      {
        name_vi: 'Ốc hương sống',
        name_en: 'Babylonia snail',
        description: 'Ốc vỏ hoa văn đẹp, thịt giòn.',
        usage: 'Hấp sả, xào bơ tỏi, rang muối.',
        storage: 'Ngâm nước biển nhân tạo, giữ mát 4°C.',
        default_unit: 'kg'
      }
    ]
  },
  {
    category: 'plant_protein',
    items: [
      {
        name_vi: 'Đậu phụ non',
        name_en: 'Silken tofu',
        description: 'Đậu phụ mềm, kết cấu mịn.',
        usage: 'Hấp nấm, súp miso, trộn salad lạnh.',
        storage: 'Để tủ mát 4°C, dùng trong 3 ngày.',
        default_unit: 'bìa'
      },
      {
        name_vi: 'Đậu phụ chiên',
        name_en: 'Firm fried tofu',
        description: 'Đậu phụ chắc, đã chiên vàng.',
        usage: 'Kho cà, xào rau, nấu canh chua.',
        storage: 'Bảo quản ngăn mát, dùng trong 3 ngày.',
        default_unit: 'bìa'
      },
      {
        name_vi: 'Đậu hũ ky tươi',
        name_en: 'Fresh bean curd sheet',
        description: 'Lớp đậu hũ ky mềm, thơm đậu nành.',
        usage: 'Cuốn chiên, nấu lẩu chay, xào cần tỏi.',
        storage: 'Bọc kín, mát 4°C dùng trong 2 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Tempeh đậu nành',
        name_en: 'Soy tempeh',
        description: 'Đạm lên men Indonesia, vị hạt bùi.',
        usage: 'Chiên giòn, rim xì dầu, làm burger chay.',
        storage: 'Để ngăn mát 4°C tối đa 5 ngày hoặc đông lạnh.',
        default_unit: 'g'
      },
      {
        name_vi: 'Seitan lúa mì',
        name_en: 'Wheat gluten seitan',
        description: 'Protein lúa mì kết cấu dai giống thịt.',
        usage: 'Xào sả ớt, kho tiêu, nướng BBQ chay.',
        storage: 'Bảo quản mát 4°C tối đa 3 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu gà nấu chín',
        name_en: 'Cooked chickpeas',
        description: 'Đậu gà mềm, thơm, giàu đạm thực vật.',
        usage: 'Hummus, salad Địa Trung Hải, cà ri chay.',
        storage: 'Để tủ mát trong nước ngâm muối nhẹ 3 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu nành luộc',
        name_en: 'Boiled soybeans',
        description: 'Hạt đậu vàng, mềm, thích hợp chế biến chay.',
        usage: 'Làm sữa đậu, trộn cơm, xào cay.',
        storage: 'Bảo quản mát 4°C trong 48 giờ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đạm đậu nành sợi',
        name_en: 'Textured soy protein',
        description: 'Sợi đạm khô, cần ngâm nở trước khi dùng.',
        usage: 'Thay thịt xay trong món chay, sốt spaghetti.',
        storage: 'Để khô thoáng, dùng trong 6 tháng.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'leafy_greens',
    items: [
      {
        name_vi: 'Rau bina',
        name_en: 'Spinach',
        description: 'Lá xanh đậm, nhiều sắt và folate.',
        usage: 'Xào tỏi, trộn salad, nấu canh miso.',
        storage: 'Bọc giấy hút ẩm, giữ mát 4°C trong 3 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cải bó xôi non',
        name_en: 'Baby spinach',
        description: 'Lá nhỏ mềm, vị ngọt nhẹ.',
        usage: 'Salad, smoothie xanh, xào nhẹ.',
        storage: 'Hút chân không, giữ mát 2-4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cải xoăn kale',
        name_en: 'Curly kale',
        description: 'Lá xoăn, giàu vitamin K và chất xơ.',
        usage: 'Làm chips nướng, smoothie, hầm súp.',
        storage: 'Giữ lạnh 0-4°C, xịt ẩm nhẹ.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cải thìa',
        name_en: 'Bok choy',
        description: 'Thân trắng, lá xanh, vị ngọt thanh.',
        usage: 'Xào dầu hào, luộc chấm xì dầu.',
        storage: 'Bọc kín, mát 4°C trong 4 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Rau cải thảo',
        name_en: 'Napa cabbage',
        description: 'Lá mềm, giòn, phổ biến trong kim chi.',
        usage: 'Lẩu, kim chi, cuốn lẩu, xào thịt.',
        storage: 'Giữ lạnh 4°C, tránh nén chặt.',
        default_unit: 'g'
      },
      {
        name_vi: 'Xà lách romaine',
        name_en: 'Romaine lettuce',
        description: 'Lá cứng giòn, vị hơi đắng nhẹ.',
        usage: 'Salad Caesar, ăn kèm bánh cuốn, bún.',
        storage: 'Để trong hộp kín, mát 3-5°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Xà lách lolo tím',
        name_en: 'Red lollo lettuce',
        description: 'Lá xoăn tím, tạo màu sắc đẹp mắt.',
        usage: 'Trang trí đĩa, salad trộn dầu giấm.',
        storage: 'Giữ lạnh 4°C, tránh dập gãy.',
        default_unit: 'g'
      },
      {
        name_vi: 'Rau muống',
        name_en: 'Water spinach',
        description: 'Thân rỗng, lá dài, vị ngọt.',
        usage: 'Luộc, xào tỏi, nấu canh chua.',
        storage: 'Ngâm nước lạnh, giữ mát 4°C trong 2 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Rau dền đỏ',
        name_en: 'Red amaranth',
        description: 'Lá đỏ tím, giàu chất chống oxy hóa.',
        usage: 'Nấu canh, xào tỏi, trộn salad ấm.',
        storage: 'Gói giấy ẩm nhẹ, mát 4°C.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'root_stem',
    items: [
      {
        name_vi: 'Khoai tây vàng',
        name_en: 'Yukon gold potato',
        description: 'Khoai ruột vàng, bở vừa phải, thơm bơ.',
        usage: 'Nghiền bơ, nướng lò, chiên giòn.',
        storage: 'Để nơi thoáng mát, tránh ánh sáng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Khoai lang mật',
        name_en: 'Japanese sweet potato',
        description: 'Thịt vàng, ngọt, dẻo.',
        usage: 'Nướng than, hấp, làm bánh.',
        storage: 'Bảo quản nhiệt độ phòng, tránh lạnh sâu.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cà rốt hữu cơ',
        name_en: 'Organic carrot',
        description: 'Củ cà rốt màu cam tươi, giòn ngọt.',
        usage: 'Hầm súp, salad, xào bơ.',
        storage: 'Giữ lạnh 4°C, tránh ẩm ướt.',
        default_unit: 'g'
      },
      {
        name_vi: 'Củ dền đỏ',
        name_en: 'Red beetroot',
        description: 'Củ đỏ tía, giàu betalain.',
        usage: 'Nướng nguyên củ, ép nước, trộn salad.',
        storage: 'Giữ lạnh 4°C, bọc giấy hút ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Củ cải trắng',
        name_en: 'Daikon radish',
        description: 'Củ dài, vị ngọt, nhiều nước.',
        usage: 'Hầm xương, muối chua, nấu canh.',
        storage: 'Giữ lạnh 4°C tối đa 1 tuần.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cần tây stalk',
        name_en: 'Celery stalk',
        description: 'Thân giòn, mùi thơm nhẹ.',
        usage: 'Làm nước ép, xào bò, nấu súp.',
        storage: 'Bọc giấy, giữ trong hộp kín mát 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Măng tây xanh',
        name_en: 'Green asparagus',
        description: 'Thân măng non, giòn, giàu folate.',
        usage: 'Áp chảo bơ tỏi, nướng, hấp.',
        storage: 'Đứng trong nước, bọc đầu, giữ mát 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Măng tươi',
        name_en: 'Fresh bamboo shoot',
        description: 'Măng giòn, cần luộc khử chát trước khi nấu.',
        usage: 'Cà ri măng, xào lá lốt, kho cá.',
        storage: 'Ngâm nước gạo, thay nước hàng ngày, giữ mát.',
        default_unit: 'g'
      },
      {
        name_vi: 'Củ sen tươi',
        name_en: 'Fresh lotus root',
        description: 'Củ rỗng lỗ, giòn, thơm dịu.',
        usage: 'Nấu canh, chiên xù, trộn salad.',
        storage: 'Ngâm nước chanh loãng, giữ lạnh 4°C.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'fruit_vegetables',
    items: [
      {
        name_vi: 'Cà chua beefsteak',
        name_en: 'Beefsteak tomato',
        description: 'Quả to, ngọt, ít hạt.',
        usage: 'Làm salad, sốt pasta, nướng.',
        storage: 'Để nhiệt độ phòng, tránh lạnh sâu.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cà chua bi đỏ',
        name_en: 'Cherry tomato',
        description: 'Quả nhỏ, ngọt, nhiều nước.',
        usage: 'Salad, nướng xiên, trang trí.',
        storage: 'Giữ mát 8-10°C, tránh đọng nước.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bí ngòi xanh',
        name_en: 'Green zucchini',
        description: 'Thân dài, vị ngọt nhẹ.',
        usage: 'Xào tỏi, nướng phô mai, spiralized.',
        storage: 'Giữ lạnh 4-6°C, tránh dập nát.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cà tím tròn',
        name_en: 'Globe eggplant',
        description: 'Cà tím vỏ bóng, ruột trắng kem.',
        usage: 'Nướng mỡ hành, cà bung, ratatouille.',
        storage: 'Nhiệt độ phòng 20°C, tránh lạnh.',
        default_unit: 'g'
      },
      {
        name_vi: 'Dưa leo baby',
        name_en: 'Baby cucumber',
        description: 'Vỏ mỏng, ít hạt, giòn.',
        usage: 'Ăn sống, muối dưa, làm nước detox.',
        storage: 'Giữ lạnh 4-6°C trong hộp kín.',
        default_unit: 'g'
      },
      {
        name_vi: 'Ớt chuông đỏ',
        name_en: 'Red bell pepper',
        description: 'Vỏ đỏ bóng, vị ngọt.',
        usage: 'Nướng, xào, làm gỏi.',
        storage: 'Giữ lạnh 4°C, tránh đè nặng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Ớt chuông vàng',
        name_en: 'Yellow bell pepper',
        description: 'Ngọt dịu, giàu vitamin C.',
        usage: 'Salad, nhồi thịt nướng, stir-fry.',
        storage: 'Bảo quản 4°C, dùng trong 5 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Ớt chuông xanh',
        name_en: 'Green bell pepper',
        description: 'Vị hăng nhẹ, thích hợp món xào.',
        usage: 'Xào bò, pizza topping, fajitas.',
        storage: 'Giữ mát 4°C, tránh ẩm cao.',
        default_unit: 'g'
      },
      {
        name_vi: 'Khổ qua',
        name_en: 'Bitter melon',
        description: 'Vỏ sần, vị đắng đặc trưng.',
        usage: 'Xào trứng, hầm nhồi thịt, làm gỏi.',
        storage: 'Giữ lạnh 4-6°C trong túi giấy.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bí đỏ hồ lô',
        name_en: 'Butternut squash',
        description: 'Thịt vàng cam, ngọt, béo.',
        usage: 'Nấu súp, nướng mật ong, xào tỏi.',
        storage: 'Để nơi khô ráo, dùng trong 2 tuần.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'mushrooms',
    items: [
      {
        name_vi: 'Nấm hương tươi',
        name_en: 'Fresh shiitake mushroom',
        description: 'Tai nấm nâu, thịt dày, thơm đặc trưng.',
        usage: 'Kho, xào, làm nước dùng chay.',
        storage: 'Giữ lạnh 2-4°C, bọc giấy thấm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Nấm hương khô',
        name_en: 'Dried shiitake mushroom',
        description: 'Nấm đã sấy, cần ngâm mềm trước khi nấu.',
        usage: 'Hầm, kho chay, làm nước dùng.',
        storage: 'Để nơi khô thoáng, kín gió, 6 tháng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Nấm kim châm',
        name_en: 'Enoki mushroom',
        description: 'Thân mảnh, đầu nhỏ, vị ngọt.',
        usage: 'Lẩu, cuộn thịt nướng, xào bơ.',
        storage: 'Giữ lạnh 2-4°C, dùng trong 3 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Nấm mỡ trắng',
        name_en: 'White button mushroom',
        description: 'Tai nhỏ, màu trắng, vị nhẹ.',
        usage: 'Xào bơ, pizza, súp kem.',
        storage: 'Hộp kín, giữ mát 2-4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Nấm bào ngư xám',
        name_en: 'Oyster mushroom',
        description: 'Tai nấm lớn, màu xám nhạt.',
        usage: 'Chiên giòn, kho tiêu, xào dầu hào.',
        storage: 'Bọc giấy, giữ lạnh 4°C tối đa 4 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Nấm đùi gà',
        name_en: 'King oyster mushroom',
        description: 'Thân dày, giòn, hấp thụ gia vị tốt.',
        usage: 'Áp chảo bơ, kho chay, nướng.',
        storage: 'Giữ lạnh 4°C, tránh ẩm cao.',
        default_unit: 'g'
      },
      {
        name_vi: 'Nấm rơm tươi',
        name_en: 'Straw mushroom',
        description: 'Nấm hình trứng, vị ngọt.',
        usage: 'Nấu canh chua, xào tỏi, kho chay.',
        storage: 'Giữ lạnh 4°C, dùng trong 2 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Nấm linh chi trắng',
        name_en: 'Shimeji mushroom',
        description: 'Chùm nấm nhỏ, vị umami nhẹ.',
        usage: 'Xào bơ tỏi, súp miso, cơm chiên.',
        storage: 'Giữ lạnh 2-4°C, bọc kín.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'aromatics',
    items: [
      {
        name_vi: 'Hành tím',
        name_en: 'Shallot',
        description: 'Củ nhỏ, thơm, vỏ tím.',
        usage: 'Phi thơm, muối chua ngọt, làm mắm.',
        storage: 'Để nơi khô, thoáng, tránh ánh sáng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hành tây vàng',
        name_en: 'Yellow onion',
        description: 'Vị ngọt, thơm nhẹ sau khi nấu.',
        usage: 'Nấu súp, xào, làm nước sốt.',
        storage: 'Giữ nơi thoáng mát, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Tỏi ta',
        name_en: 'Purple garlic',
        description: 'Tép nhỏ, thơm nồng.',
        usage: 'Phi vàng, ướp thịt, ngâm giấm.',
        storage: 'Để nơi khô, tránh ánh nắng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Gừng tươi',
        name_en: 'Fresh ginger',
        description: 'Thân củ, vị cay ấm.',
        usage: 'Xào thịt, hầm canh, làm trà gừng.',
        storage: 'Giữ lạnh 4°C hoặc đông lạnh lát mỏng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Nghệ tươi',
        name_en: 'Fresh turmeric',
        description: 'Củ màu vàng cam, mùi đất nhẹ.',
        usage: 'Cà ri, ướp thịt, nấu bún cá.',
        storage: 'Để mát 4°C, bọc giấy hút ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Sả cây',
        name_en: 'Lemongrass stalk',
        description: 'Thân sả thơm, vị cay the.',
        usage: 'Ướp nướng, nấu lẩu, đun nước uống.',
        storage: 'Giữ ẩm nhẹ, mát 4°C, dùng trong 5 ngày.',
        default_unit: 'cây'
      },
      {
        name_vi: 'Rau mùi ta',
        name_en: 'Vietnamese coriander',
        description: 'Lá mảnh, vị cay nhẹ.',
        usage: 'Rắc lên phở, gỏi cuốn, cháo.',
        storage: 'Cắm nước lạnh, giữ mát 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Rau ngò rí',
        name_en: 'Cilantro',
        description: 'Lá thơm, vị chanh nhẹ.',
        usage: 'Trang trí, salsa, salad.',
        storage: 'Cắm vào cốc nước, bọc túi, giữ mát.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hành lá',
        name_en: 'Scallion',
        description: 'Thân rỗng, lá xanh, vị thơm nhẹ.',
        usage: 'Phi dầu, rắc canh, làm mỡ hành.',
        storage: 'Bọc giấy ẩm, giữ lạnh 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Lá chanh',
        name_en: 'Kaffir lime leaf',
        description: 'Lá thơm hương tinh dầu.',
        usage: 'Aromat lẩu Thái, kho cá, rim mắm.',
        storage: 'Để ngăn mát, bọc kín tránh khô.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'spices_seasonings',
    items: [
      {
        name_vi: 'Muối biển hạt',
        name_en: 'Coarse sea salt',
        description: 'Muối kết tinh tự nhiên, vị mặn đậm.',
        usage: 'Ướp nướng, rang muối, muối dưa.',
        storage: 'Để khô thoáng, đóng kín nắp.',
        default_unit: 'g'
      },
      {
        name_vi: 'Muối hồng Himalaya',
        name_en: 'Himalayan pink salt',
        description: 'Muối hồng, giàu khoáng chất.',
        usage: 'Ướp steak, pha nước detox.',
        storage: 'Hũ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt tiêu đen nguyên',
        name_en: 'Whole black peppercorn',
        description: 'Hạt tiêu thơm, cay nồng.',
        usage: 'Xay tươi, rim thịt, làm sốt.',
        storage: 'Lọ kín, nơi khô mát.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt tiêu xanh ngâm',
        name_en: 'Green peppercorn in brine',
        description: 'Tiêu xanh giữ nguyên hương tươi.',
        usage: 'Sốt tiêu xanh, ướp bò, pate.',
        storage: 'Bảo quản lạnh sau khi mở nắp.',
        default_unit: 'hũ'
      },
      {
        name_vi: 'Bột ớt paprika',
        name_en: 'Smoked paprika powder',
        description: 'Bột ớt đỏ hun khói nhẹ.',
        usage: 'Ướp gà nướng, paella, sốt BBQ.',
        storage: 'Lọ kín, tránh ánh sáng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bột nghệ vàng',
        name_en: 'Turmeric powder',
        description: 'Bột vàng, chống oxy hóa.',
        usage: 'Cà ri, xào nghệ, ướp cá.',
        storage: 'Đậy kín, nơi khô ráo.',
        default_unit: 'g'
      },
      {
        name_vi: 'Quế thanh',
        name_en: 'Cinnamon stick',
        description: 'Thanh quế thơm, vị ngọt ấm.',
        usage: 'Nấu phở, kho thịt, đồ uống.',
        storage: 'Lọ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hoa hồi',
        name_en: 'Star anise',
        description: 'Hoa tám cánh, mùi cam thảo.',
        usage: 'Gia vị phở, kho tàu, rim mật ong.',
        storage: 'Hũ kín, môi trường khô.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt thì là Ai Cập',
        name_en: 'Cumin seed',
        description: 'Hạt thảo mộc, mùi ấm.',
        usage: 'Ướp thịt nướng, cà ri, falafel.',
        storage: 'Lọ kín, tránh nhiệt cao.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bột cà ri Madras',
        name_en: 'Madras curry powder',
        description: 'Hỗn hợp cà ri cay, màu vàng.',
        usage: 'Cà ri gà, cà ri tôm, xào rau củ.',
        storage: 'Lọ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Ngũ vị hương',
        name_en: 'Five-spice powder',
        description: 'Gồm quế, hồi, đinh hương, hồ tiêu, hạt mùi.',
        usage: 'Ướp vịt, thịt quay, giò chả.',
        storage: 'Đậy kín, dùng trong 6 tháng.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'fermented_condiments',
    items: [
      {
        name_vi: 'Nước mắm Phú Quốc 40N',
        name_en: 'Phu Quoc fish sauce 40N',
        description: 'Độ đạm 40, màu hổ phách, mùi thơm nồng.',
        usage: 'Chấm, pha nước mắm chua ngọt, rim thịt.',
        storage: 'Để nơi thoáng mát, đậy kín nắp.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Mắm tôm Huế',
        name_en: 'Fermented shrimp paste',
        description: 'Mắm tôm nghiền, lên men thơm đặc trưng.',
        usage: 'Bún đậu, chưng thịt, kho quẹt.',
        storage: 'Đậy kín, giữ lạnh sau mở nắp.',
        default_unit: 'g'
      },
      {
        name_vi: 'Tương bần cổ truyền',
        name_en: 'Vietnamese fermented soybean paste',
        description: 'Tương đặc màu nâu, vị ngọt mặn.',
        usage: 'Chấm rau, kho cá, nấu lẩu riêu.',
        storage: 'Giữ mát 4°C, dùng trong 3 tháng.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Xì dầu Nhật Kikkoman',
        name_en: 'Kikkoman soy sauce',
        description: 'Xì dầu lên men tự nhiên, vị mặn ngọt cân bằng.',
        usage: 'Ướp sashimi, xào rau, nấu soba.',
        storage: 'Đậy kín, tránh nắng.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Tương ớt Gochujang',
        name_en: 'Gochujang chili paste',
        description: 'Tương ớt Hàn, vị cay ngọt, sệt.',
        usage: 'Kimchi, bibimbap, ướp BBQ.',
        storage: 'Giữ lạnh 4°C sau mở nắp.',
        default_unit: 'g'
      },
      {
        name_vi: 'Tương miso trắng',
        name_en: 'White miso paste',
        description: 'Đậu nành lên men nhẹ, vị mặn dịu.',
        usage: 'Súp miso, ướp cá, sốt salad.',
        storage: 'Để mát 4°C, đậy kín.',
        default_unit: 'g'
      },
      {
        name_vi: 'Kim chi cải thảo',
        name_en: 'Napa cabbage kimchi',
        description: 'Cải thảo lên men cay chua.',
        usage: 'Ăn kèm, nấu canh kim chi, chiên xào.',
        storage: 'Giữ lạnh 2-4°C, lên men tự nhiên.',
        default_unit: 'g'
      },
      {
        name_vi: 'Dưa cải chua',
        name_en: 'Vietnamese pickled mustard greens',
        description: 'Cải muối chua nhẹ, màu vàng.',
        usage: 'Xào tóp mỡ, nấu canh, kho cá.',
        storage: 'Ngâm nước muối, giữ mát 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Tương đậu phộng satay',
        name_en: 'Peanut satay sauce',
        description: 'Sốt đậu phộng cay béo.',
        usage: 'Chấm gỏi cuốn, ướp nướng satay.',
        storage: 'Giữ lạnh sau mở nắp.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'grains_rice',
    items: [
      {
        name_vi: 'Gạo thơm Jasmine',
        name_en: 'Jasmine rice',
        description: 'Hạt dài, thơm, mềm khi nấu.',
        usage: 'Cơm trắng, cơm gà, cơm chiên.',
        storage: 'Để trong thùng kín, nơi khô.',
        default_unit: 'kg'
      },
      {
        name_vi: 'Gạo lứt đỏ',
        name_en: 'Red brown rice',
        description: 'Hạt đỏ, nhiều cám, giòn nhẹ.',
        usage: 'Cơm lứt, cháo, cơm trộn.',
        storage: 'Đóng kín, tránh ẩm.',
        default_unit: 'kg'
      },
      {
        name_vi: 'Gạo nếp cái hoa vàng',
        name_en: 'Fragrant glutinous rice',
        description: 'Hạt nếp dẻo, thơm.',
        usage: 'Xôi, bánh chưng, chè.',
        storage: 'Thùng kín, dùng trong 6 tháng.',
        default_unit: 'kg'
      },
      {
        name_vi: 'Yến mạch cán dẹt',
        name_en: 'Rolled oats',
        description: 'Yến mạch cán mỏng, giàu chất xơ.',
        usage: 'Granola, cháo yến mạch, bánh cookies.',
        storage: 'Lọ kín, tránh ẩm mốc.',
        default_unit: 'g'
      },
      {
        name_vi: 'Quinoa trắng',
        name_en: 'White quinoa',
        description: 'Hạt quinoa giàu đạm, không gluten.',
        usage: 'Salad, cơm trộn, cháo dinh dưỡng.',
        storage: 'Để khô, kín nắp.',
        default_unit: 'g'
      },
      {
        name_vi: 'Lúa mạch ngọc trai',
        name_en: 'Pearl barley',
        description: 'Hạt lúa mạch mài nhẵn, vị bùi.',
        usage: 'Súp lúa mạch, risotto, cháo.',
        storage: 'Hộp kín, nơi mát.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bột ngô mịn',
        name_en: 'Fine cornmeal',
        description: 'Bột ngô vàng mịn.',
        usage: 'Polenta, bánh ngô, làm sệt súp.',
        storage: 'Lọ kín, tránh côn trùng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bột mì đa dụng',
        name_en: 'All-purpose flour',
        description: 'Bột mì trắng proteint trung bình.',
        usage: 'Bánh mì, bánh ngọt, áo chiên.',
        storage: 'Hũ kín, nơi khô.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bột gạo tẻ',
        name_en: 'Rice flour',
        description: 'Bột gạo mịn, không gluten.',
        usage: 'Bánh cuốn, bánh khọt, tạo độ sánh.',
        storage: 'Lọ kín, tránh ẩm.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'noodles_pasta',
    items: [
      {
        name_vi: 'Bún gạo khô',
        name_en: 'Dried rice vermicelli',
        description: 'Sợi bún nhỏ, trắng, cần trụng mềm.',
        usage: 'Bún thịt nướng, gỏi cuốn, bún xào.',
        storage: 'Để nơi khô, dùng trong 1 năm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bánh phở tươi',
        name_en: 'Fresh pho noodle',
        description: 'Bánh phở dẹt, mềm.',
        usage: 'Phở bò, phở áp chảo, cuốn.',
        storage: 'Giữ lạnh 4°C, dùng trong 3 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Miến dong',
        name_en: 'Sweet potato vermicelli',
        description: 'Sợi trong, dai, làm từ củ dong.',
        usage: 'Miến xào, miến lươn, lẩu.',
        storage: 'Để khô, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Mì trứng tươi',
        name_en: 'Fresh egg noodle',
        description: 'Sợi vàng, mềm, thơm trứng.',
        usage: 'Mì hoành thánh, mì xào giòn.',
        storage: 'Giữ lạnh 0-4°C, dùng trong 3 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Mì ramen tươi',
        name_en: 'Fresh ramen noodle',
        description: 'Sợi ramen vàng, dai, giàu kiềm.',
        usage: 'Ramen nước, mazemen, stir-fry.',
        storage: 'Đông lạnh hoặc mát 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Mì soba',
        name_en: 'Buckwheat soba noodle',
        description: 'Sợi nâu, vị hạt, làm từ kiều mạch.',
        usage: 'Soba lạnh, soba nóng, salad.',
        storage: 'Để khô, kín nắp.',
        default_unit: 'g'
      },
      {
        name_vi: 'Mì udon đông lạnh',
        name_en: 'Frozen udon noodle',
        description: 'Sợi dày, dai, tiện lợi.',
        usage: 'Udon nước, xào, stir-fry.',
        storage: 'Đông lạnh, rã đông trước khi dùng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Spaghetti số 7',
        name_en: 'Spaghetti pasta No.7',
        description: 'Sợi dài, đường kính trung bình.',
        usage: 'Pasta bolognese, aglio e olio.',
        storage: 'Để khô, kín.',
        default_unit: 'g'
      },
      {
        name_vi: 'Penne rigate',
        name_en: 'Penne rigate',
        description: 'Ống pasta có vân, giữ sốt tốt.',
        usage: 'Penne Arabiata, salad pasta.',
        storage: 'Để khô, kín nắp.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'legumes_pulses',
    items: [
      {
        name_vi: 'Đậu xanh cà vỏ',
        name_en: 'Hulled mung bean',
        description: 'Đậu xanh bỏ vỏ, màu vàng.',
        usage: 'Chè, nhân bánh, nấu cháo.',
        storage: 'Để khô, kín nắp.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu đỏ azuki',
        name_en: 'Azuki red bean',
        description: 'Đậu nhỏ, vị ngọt bùi.',
        usage: 'Chè đậu đỏ, anko, súp.',
        storage: 'Hũ kín, tránh côn trùng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu đen xanh lòng',
        name_en: 'Black turtle bean',
        description: 'Vỏ đen, ruột xanh, giàu chất xơ.',
        usage: 'Nấu chè, hầm sườn, làm sữa.',
        storage: 'Đóng kín, nơi khô.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu trắng cannellini',
        name_en: 'Cannellini bean',
        description: 'Đậu trắng Ý, vị bùi.',
        usage: 'Súp minestrone, hầm cà chua.',
        storage: 'Hũ kín, dùng trong 12 tháng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu lăng đỏ',
        name_en: 'Red lentil',
        description: 'Đậu lăng nhanh chín, màu đỏ cam.',
        usage: 'Cà ri dal, súp, cháo.',
        storage: 'Lọ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu lăng xanh',
        name_en: 'Green lentil',
        description: 'Đậu giữ nguyên hình khi nấu.',
        usage: 'Salad ấm, nấu kèm thịt bò.',
        storage: 'Đóng kín, để nơi mát.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu gà khô',
        name_en: 'Dry chickpea',
        description: 'Hạt đậu gà vàng, cần ngâm qua đêm.',
        usage: 'Hummus, falafel, rau trộn.',
        storage: 'Hũ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu nành hạt',
        name_en: 'Soybean',
        description: 'Hạt vàng, giàu protein.',
        usage: 'Làm sữa đậu, đậu phụ, hầm.',
        storage: 'Để khô, kín.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu Hà Lan tách hạt',
        name_en: 'Split pea',
        description: 'Đậu Hà Lan khô, nấu nhanh.',
        usage: 'Súp đậu, cháo.',
        storage: 'Để nơi khô.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'nuts_seeds',
    items: [
      {
        name_vi: 'Hạnh nhân nguyên hạt',
        name_en: 'Whole almond',
        description: 'Hạt hạnh nhân, vị bùi.',
        usage: 'Granola, sữa hạnh nhân, snack.',
        storage: 'Hũ kín, tránh nắng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạnh nhân lát',
        name_en: 'Sliced almond',
        description: 'Hạnh nhân thái mỏng.',
        usage: 'Trang trí bánh, salad.',
        storage: 'Lọ kín, tủ mát 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt điều rang muối',
        name_en: 'Roasted cashew with salt',
        description: 'Hạt điều vàng, mặn ngọt.',
        usage: 'Snack, xào, làm sữa hạt.',
        storage: 'Lọ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt óc chó',
        name_en: 'Walnut',
        description: 'Nhân óc chó nâu, giàu omega-3.',
        usage: 'Salad, bánh nướng, granola.',
        storage: 'Giữ lạnh 4°C chống ôi dầu.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt mắc ca',
        name_en: 'Macadamia nut',
        description: 'Hạt tròn, giòn béo.',
        usage: 'Snack, bánh quy, bơ hạt.',
        storage: 'Lọ kín, mát 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt bí xanh',
        name_en: 'Pumpkin seed',
        description: 'Hạt bí bóc vỏ, màu xanh.',
        usage: 'Granola, topping salad, ăn vặt.',
        storage: 'Lọ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt hướng dương bóc vỏ',
        name_en: 'Shelled sunflower seed',
        description: 'Hạt nhỏ, vị bùi.',
        usage: 'Salad, bánh mì, snack.',
        storage: 'Hũ kín, tủ mát.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt chia đen',
        name_en: 'Black chia seed',
        description: 'Hạt nhỏ, giàu omega-3.',
        usage: 'Ngâm pudding, smoothie, rắc sữa chua.',
        storage: 'Lọ kín, khô ráo.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hạt lanh vàng',
        name_en: 'Golden flaxseed',
        description: 'Hạt vàng, giàu chất xơ hòa tan.',
        usage: 'Xay uống, làm bánh, rắc salad.',
        storage: 'Giữ lạnh để tránh ôi dầu.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đậu phộng rang',
        name_en: 'Roasted peanut',
        description: 'Đậu phộng rang giòn, thơm.',
        usage: 'Làm bơ đậu, topping, snack.',
        storage: 'Lọ kín, tránh ẩm.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'dairy_eggs',
    items: [
      {
        name_vi: 'Sữa tươi thanh trùng không đường',
        name_en: 'Pasteurized whole milk',
        description: 'Sữa bò nguyên kem, thanh trùng 75°C.',
        usage: 'Uống trực tiếp, nấu béchamel, pha cà phê.',
        storage: 'Giữ lạnh 2-4°C, dùng trong 7 ngày.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Sữa tươi thanh trùng có đường',
        name_en: 'Sweetened milk',
        description: 'Sữa có bổ sung đường, vị ngọt nhẹ.',
        usage: 'Bánh flan, đồ uống, ngũ cốc sáng.',
        storage: 'Giữ lạnh 2-4°C.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Sữa chua Hy Lạp',
        name_en: 'Greek yogurt',
        description: 'Sữa chua lọc đặc, giàu protein.',
        usage: 'Breakfast bowl, tzatziki, dessert.',
        storage: 'Giữ lạnh 2-4°C, đậy kín.',
        default_unit: 'g'
      },
      {
        name_vi: 'Whipping cream 35%',
        name_en: 'Heavy whipping cream 35%',
        description: 'Kem béo dùng đánh bông hoặc nấu sốt.',
        usage: 'Sốt kem, mousse, topping bánh.',
        storage: 'Giữ lạnh 2-4°C, lắc nhẹ trước dùng.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Cream cheese',
        name_en: 'Cream cheese',
        description: 'Phô mai kem mềm, vị chua nhẹ.',
        usage: 'Cheesecake, phết bánh mì, sốt dip.',
        storage: 'Giữ lạnh 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Phô mai mozzarella tươi',
        name_en: 'Fresh mozzarella',
        description: 'Phô mai mềm, kéo sợi, ướp muối nhẹ.',
        usage: 'Pizza, caprese salad, nướng lò.',
        storage: 'Ngâm trong whey, giữ lạnh 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Phô mai parmesan bào',
        name_en: 'Grated parmesan',
        description: 'Phô mai cứng, mặn, thơm hạt.',
        usage: 'Rắc pasta, risotto, soup.',
        storage: 'Lọ kín, giữ lạnh 4°C.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bơ lạt Pháp',
        name_en: 'Unsalted butter',
        description: 'Bơ vàng, không muối, hương sữa.',
        usage: 'Nướng bánh, làm sốt bơ chanh.',
        storage: 'Giữ lạnh 2-4°C, dùng 2 tháng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Trứng gà công nghiệp',
        name_en: 'Farm chicken egg',
        description: 'Trứng loại lớn, vỏ nâu nhạt.',
        usage: 'Nướng bánh, chiên, hấp.',
        storage: 'Giữ lạnh 4°C, dùng 2-3 tuần.',
        default_unit: 'quả'
      },
      {
        name_vi: 'Sữa hạnh nhân',
        name_en: 'Almond milk',
        description: 'Sữa thực vật, không lactose.',
        usage: 'Sinh tố, latte, làm bánh chay.',
        storage: 'Giữ lạnh 2-4°C, lắc đều.',
        default_unit: 'ml'
      }
    ]
  },
  {
    category: 'oils_fats',
    items: [
      {
        name_vi: 'Dầu oliu extra virgin',
        name_en: 'Extra virgin olive oil',
        description: 'Dầu ép lạnh, hương trái cây.',
        usage: 'Trộn salad, ăn sống, nấu nhẹ.',
        storage: 'Chai tối màu, tránh nhiệt cao.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Dầu mè rang',
        name_en: 'Toasted sesame oil',
        description: 'Dầu thơm mùi mè rang đậm.',
        usage: 'Ướp, làm sốt, rưới món xào.',
        storage: 'Chai kín, tránh nắng.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Dầu đậu nành',
        name_en: 'Soybean oil',
        description: 'Dầu thực vật phổ biến, chịu nhiệt tốt.',
        usage: 'Chiên ngập, xào, trộn salad.',
        storage: 'Đậy kín, tránh ánh sáng.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Dầu hướng dương',
        name_en: 'Sunflower oil',
        description: 'Dầu nhẹ, ít mùi.',
        usage: 'Chiên rán, salad.',
        storage: 'Chai kín, nơi mát.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Dầu hạt cải',
        name_en: 'Canola oil',
        description: 'Dầu hạt cải, giàu omega-3.',
        usage: 'Chiên, nướng, làm mayonnaise.',
        storage: 'Đậy kín, tránh nhiệt độ cao.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Dầu dừa tinh luyện',
        name_en: 'Refined coconut oil',
        description: 'Dầu dừa không mùi, ổn định nhiệt.',
        usage: 'Chiên giòn, làm bánh, nấu cà ri.',
        storage: 'Đậy kín, tránh ánh sáng.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Mỡ heo render',
        name_en: 'Rendered pork lard',
        description: 'Mỡ heo tinh luyện, thơm nhẹ.',
        usage: 'Chiên bánh lọc, xào rau muống.',
        storage: 'Giữ lạnh 4°C dùng trong 1 tháng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bơ cacao',
        name_en: 'Cocoa butter',
        description: 'Chất béo thực vật rắn, thơm cacao.',
        usage: 'Làm chocolate, mỹ phẩm, sốt ngọt.',
        storage: 'Để mát <25°C.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'sweeteners',
    items: [
      {
        name_vi: 'Đường cát trắng',
        name_en: 'Granulated sugar',
        description: 'Đường tinh luyện, hạt nhỏ.',
        usage: 'Nấu ăn, làm bánh, pha đồ uống.',
        storage: 'Hũ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đường vàng',
        name_en: 'Golden cane sugar',
        description: 'Đường vàng tự nhiên, mùi mật.',
        usage: 'Caramel, kho thịt, đồ uống.',
        storage: 'Lọ kín, tránh côn trùng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đường nâu muscovado',
        name_en: 'Muscovado sugar',
        description: 'Đường nâu ẩm, vị caramel mạnh.',
        usage: 'Bánh nướng, sốt BBQ, nước chấm.',
        storage: 'Đậy kín, thêm bánh mì để giữ ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đường thốt nốt',
        name_en: 'Palm sugar',
        description: 'Đường dạng bánh, vị ngọt thanh.',
        usage: 'Chè, cà ri, làm nước mắm chua ngọt.',
        storage: 'Lọ kín, nơi mát.',
        default_unit: 'g'
      },
      {
        name_vi: 'Đường phèn',
        name_en: 'Rock sugar',
        description: 'Đường tinh thể lớn, vị ngọt dịu.',
        usage: 'Chưng yến, nấu trà, rim mứt.',
        storage: 'Hũ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Mật ong hoa nhãn',
        name_en: 'Longan blossom honey',
        description: 'Mật ong vàng, thơm hoa nhãn.',
        usage: 'Pha đồ uống, ướp gà nướng.',
        storage: 'Đậy kín, nơi khô.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Mật ong rừng',
        name_en: 'Wild forest honey',
        description: 'Mật ong đậm màu, vị phức hợp.',
        usage: 'Sốt salad, nước mật ong chanh.',
        storage: 'Lọ kín, tránh nắng.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Si rô maple',
        name_en: 'Maple syrup',
        description: 'Si rô lá phong hổ phách.',
        usage: 'Pancake, glaze thịt, đồ uống.',
        storage: 'Giữ lạnh sau mở nắp.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Sirô agave',
        name_en: 'Agave syrup',
        description: 'Si rô ngọt dịu, GI thấp.',
        usage: 'Đồ uống lạnh, baking thuần chay.',
        storage: 'Chai kín, nơi mát.',
        default_unit: 'ml'
      }
    ]
  },
  {
    category: 'stocks_broths',
    items: [
      {
        name_vi: 'Nước dùng gà',
        name_en: 'Chicken stock',
        description: 'Nước hầm xương gà, vị ngọt thanh.',
        usage: 'Súp, risotto, nước sốt.',
        storage: 'Đông lạnh hoặc mát 4°C dùng 3 ngày.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Nước dùng bò',
        name_en: 'Beef stock',
        description: 'Hầm xương bò nhiều giờ, màu nâu.',
        usage: 'Phở, nước sốt, hầm.',
        storage: 'Đông lạnh chia khối, dùng dần.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Nước dùng heo',
        name_en: 'Pork bone broth',
        description: 'Xương heo ninh, giàu collagen.',
        usage: 'Bún bò, mì ramen, lẩu.',
        storage: 'Giữ lạnh 4°C dùng trong 2 ngày.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Nước dùng rau củ',
        name_en: 'Vegetable stock',
        description: 'Hầm rau củ, vị ngọt nhẹ.',
        usage: 'Súp chay, cơm risotto, mì chay.',
        storage: 'Đông lạnh khay, dùng dần.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Nước dừa tươi',
        name_en: 'Fresh coconut water',
        description: 'Nước dừa xiêm ngọt thanh.',
        usage: 'Kho tộ, nấu chè, đồ uống.',
        storage: 'Giữ lạnh 4°C, dùng 24 giờ.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Dashi cá bào',
        name_en: 'Bonito dashi',
        description: 'Nước dùng kombu và cá bào katsuobushi.',
        usage: 'Súp miso, udon, tamagoyaki.',
        storage: 'Giữ lạnh 3 ngày hoặc đông lạnh.',
        default_unit: 'ml'
      },
      {
        name_vi: 'Cốt lẩu Thái',
        name_en: 'Tom yum concentrate',
        description: 'Cốt cô đặc vị chua cay, thơm sả kaffir.',
        usage: 'Pha nước lẩu, xào, rim.',
        storage: 'Đậy kín, giữ lạnh.',
        default_unit: 'g'
      }
    ]
  },
  {
    category: 'dried_goods',
    items: [
      {
        name_vi: 'Rong biển kombu',
        name_en: 'Dried kombu seaweed',
        description: 'Tảo bẹ khô dày, làm dashi.',
        usage: 'Nấu nước dùng, salad wakame.',
        storage: 'Để khô, kín.',
        default_unit: 'g'
      },
      {
        name_vi: 'Rong biển nori',
        name_en: 'Nori sheet',
        description: 'Lá rong biển mỏng, nướng khô.',
        usage: 'Cuộn sushi, rắc cơm.',
        storage: 'Gói kín, tránh ẩm.',
        default_unit: 'tấm'
      },
      {
        name_vi: 'Tôm khô loại 1',
        name_en: 'Premium dried shrimp',
        description: 'Tôm sấy màu đỏ cam, thơm mạnh.',
        usage: 'Kho quẹt, gỏi xoài, nước dùng.',
        storage: 'Để nguội, hút ẩm gói kín.',
        default_unit: 'g'
      },
      {
        name_vi: 'Mực khô cán mỏng',
        name_en: 'Flattened dried squid',
        description: 'Mực phơi khô, dẻo.',
        usage: 'Nướng than, xé trộn gỏi.',
        storage: 'Để khô, kín.',
        default_unit: 'g'
      },
      {
        name_vi: 'Cá cơm khô',
        name_en: 'Dried anchovy',
        description: 'Cá cơm nhỏ phơi khô.',
        usage: 'Hầm nước dùng, rang giòn, kho quẹt.',
        storage: 'Hũ kín, tránh ánh sáng.',
        default_unit: 'g'
      },
      {
        name_vi: 'Khô bò sợi',
        name_en: 'Shredded beef jerky',
        description: 'Thịt bò khô xé, vị cay ngọt.',
        usage: 'Ăn vặt, trộn gỏi khô bò.',
        storage: 'Đậy kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Khô gà lá chanh',
        name_en: 'Vietnamese shredded chicken jerky',
        description: 'Thịt gà xé, lá chanh khô.',
        usage: 'Snack, cơm bento.',
        storage: 'Lọ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Lạp xưởng tươi',
        name_en: 'Fresh Chinese sausage',
        description: 'Xúc xích heo tẩm gia vị, sấy nhẹ.',
        usage: 'Cơm tấm, xôi mặn, xào rau củ.',
        storage: 'Giữ lạnh 0-4°C, dùng trong 7 ngày.',
        default_unit: 'g'
      },
      {
        name_vi: 'Măng khô vàng',
        name_en: 'Dried bamboo shoot',
        description: 'Măng xắt phơi khô, cần ngâm mềm.',
        usage: 'Hầm giò heo, lẩu vịt, kho.',
        storage: 'Để khô, kín.',
        default_unit: 'g'
      },
      {
        name_vi: 'Trà hoa cúc khô',
        name_en: 'Dried chrysanthemum tea',
        description: 'Hoa cúc sấy, hương dịu.',
        usage: 'Pha trà, nước detox.',
        storage: 'Hũ kín, tránh ẩm.',
        default_unit: 'g'
      },
      {
        name_vi: 'Hoa đậu biếc khô',
        name_en: 'Dried butterfly pea flower',
        description: 'Hoa xanh tím, tạo màu tự nhiên.',
        usage: 'Pha trà, nhuộm xôi, soda.',
        storage: 'Để kín, nơi khô.',
        default_unit: 'g'
      },
      {
        name_vi: 'Bánh tráng gạo',
        name_en: 'Rice paper',
        description: 'Bánh tráng mỏng, dùng cuốn gỏi.',
        usage: 'Gỏi cuốn, cuốn ram, bánh tráng trộn.',
        storage: 'Đóng kín, tránh ẩm.',
        default_unit: 'bánh'
      }
    ]
  }
];

const ingredientCatalog = ingredientCatalogGroups.flatMap(({ category, items }) =>
  items.map((item) => ({
    ...item,
    category_slug: category
  }))
);

const ingredientCategories = [];
const ingredientCategoryIndexBySlug = new Map();

ingredientCategoryCatalog.forEach((cat) => {
  const { created_at, updated_at } = nextTimestamp();
  const record = {
    id: nextId('ingredient_categories'),
    category_name: `${cat.name_vi} (${cat.name_en})`,
    created_at,
    updated_at
  };
  ingredientCategories.push(record);
  ingredientCategoryIndexBySlug.set(cat.slug, { id: record.id, meta: cat });
});

const ingredients = ingredientCatalog.map((item) => {
  const catInfo = ingredientCategoryIndexBySlug.get(item.category_slug);
  if (!catInfo) {
    throw new Error(`Không tìm thấy category slug: ${item.category_slug}`);
  }
  const { created_at, updated_at } = nextTimestamp();
  const descriptionParts = [
    `English: ${item.name_en}.`,
    item.aliases?.length ? `Tên gọi khác: ${item.aliases.join(', ')}.` : '',
    item.description,
    item.usage ? `Ứng dụng: ${item.usage}.` : '',
    item.storage ? `Bảo quản: ${item.storage}.` : '',
    item.origin ? `Nguồn gốc: ${item.origin}.` : '',
    item.nutrition ? `Dinh dưỡng: ${item.nutrition}.` : '',
    item.notes ? item.notes : '',
    `Nhóm: ${catInfo.meta.name_vi} (${catInfo.meta.name_en}) - ${catInfo.meta.description}`
  ].filter(Boolean);
  return {
    id: nextId('ingredients'),
    ingredient_name: `${item.name_vi} (${item.name_en})`,
    category_id: catInfo.id,
    description: descriptionParts.join(' '),
    created_at,
    updated_at
  };
});

const usersData = [
  { full_name: 'Nguyễn Thị Mai', email: 'mai.nguyen@example.com' },
  { full_name: 'Trần Quốc Bảo', email: 'bao.tran@example.com' },
  { full_name: 'Phạm Thu Hà', email: 'ha.pham@example.com' },
  { full_name: 'Lê Minh Khôi', email: 'khoi.le@example.com' },
  { full_name: 'Đặng Anh Thư', email: 'thu.dang@example.com' },
  { full_name: 'Võ Hoàng Nam', email: 'nam.vo@example.com' },
  { full_name: 'Bùi Gia Hân', email: 'han.bui@example.com' },
  { full_name: 'Phan Nhật Tân', email: 'tan.phan@example.com' }
];

const users = usersData.map(({ full_name, email }) => {
  const { created_at, updated_at } = nextTimestamp();
  return {
    id: nextId('users'),
    full_name,
    email,
    password: fakeHash(email),
    avatar: '',
    status: 'active',
    role: 'user',
    created_at,
    updated_at
  };
});

const admins = [
  { username: 'superchef', role: 'superadmin' },
  { username: 'reviewer01', role: 'moderator' }
].map(({ username, role }) => {
  const { created_at, updated_at } = nextTimestamp();
  return {
    id: nextId('admins'),
    username,
    password: fakeHash(username),
    role,
    created_at,
    updated_at
  };
});

const slugify = (value) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const RECIPE_COUNT = 200;

const mains = [
  'Ức gà',
  'Đùi gà',
  'Cánh gà',
  'Thịt bò thăn',
  'Thịt bò ba chỉ',
  'Tôm sú',
  'Tôm thẻ',
  'Cá hồi',
  'Cá ngừ',
  'Cá basa',
  'Đậu phụ non',
  'Đậu phụ chiên',
  'Nấm hương',
  'Nấm kim châm',
  'Bí đỏ',
  'Khoai tây',
  'Bông cải xanh',
  'Rau bina',
  'Mì ý',
  'Bún gạo'
];

const methodStyles = [
  { label: 'áp chảo', description: 'được áp chảo vàng đều giữ nguyên độ ẩm' },
  { label: 'nướng lò', description: 'nướng lò ở nhiệt độ cao cho lớp vỏ giòn nhẹ' },
  { label: 'xào', description: 'xào nhanh tay ở lửa lớn để giữ độ giòn' },
  { label: 'om', description: 'om lửa nhỏ cho gia vị thấm đều' },
  { label: 'hấp', description: 'hấp cách thủy để giữ trọn dinh dưỡng' },
  { label: 'ram', description: 'ram sệt với nước sốt đậm đà' },
  { label: 'chiên giòn', description: 'chiên giòn rụm bên ngoài, mềm ngọt bên trong' },
  { label: 'trộn salad', description: 'trộn nhanh tay cùng các loại rau xanh tươi' },
  { label: 'kho tiêu', description: 'kho tiêu cay cay thơm nồng' },
  { label: 'hầm thảo mộc', description: 'hầm cùng thảo mộc cho hương vị sâu' }
];

const flavorProfiles = [
  { label: 'sốt bơ tỏi', description: 'có hương bơ béo hòa quyện cùng tỏi phi dậy mùi' },
  { label: 'sốt chanh mật ong', description: 'đậm vị chua ngọt thanh mát' },
  { label: 'sốt tiêu đen', description: 'cay nồng vừa phải, kích thích vị giác' },
  { label: 'sốt teriyaki', description: 'ngọt mặn kiểu Nhật hài hòa' },
  { label: 'rang muối ớt', description: 'giòn cay hấp dẫn' },
  { label: 'chanh sả', description: 'thơm mùi sả, thoảng vị chanh' },
  { label: 'thảo mộc Địa Trung Hải', description: 'mang hương rosemary và thyme nhè nhẹ' },
  { label: 'sốt cà chua', description: 'đậm đà kiểu Ý' },
  { label: 'sốt me', description: 'chua ngọt cân bằng rất dễ ăn' },
  { label: 'mật ong gừng', description: 'ấm áp và dịu nhẹ' },
  { label: 'sa tế tôm', description: 'cay nồng, thơm mùi dầu điều' },
  { label: 'sốt bơ chanh dây', description: 'béo nhẹ, hậu vị chua nhẹ độc đáo' }
];

const servingNotes = [
  'Ăn kèm cơm trắng nóng.',
  'Phục vụ cùng bánh mì giòn.',
  'Dùng chung với salad xanh tươi.',
  'Thích hợp cho bữa tối gia đình ấm cúng.',
  'Lý tưởng cho thực đơn eat clean.',
  'Có thể chuẩn bị trước và hâm nóng nhanh.',
  'Kết hợp cùng súp khai vị nhẹ nhàng.',
  'Ngon hơn khi thêm chút rau thơm tươi.',
  'Hợp với khẩu vị người Việt và cả trẻ nhỏ.',
  'Tăng hương vị với ít vỏ chanh bào.',
  'Có thể biến tấu với rau củ theo mùa.',
  'Phù hợp làm món chính trong tiệc nhỏ.'
];

const shuffleInPlace = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};

const allCombos = [];
mains.forEach((main) => {
  methodStyles.forEach((method) => {
    flavorProfiles.forEach((flavor) => {
      allCombos.push({ main, method, flavor });
    });
  });
});

if (RECIPE_COUNT > allCombos.length) {
  throw new Error(`Không đủ combination để tạo ${RECIPE_COUNT} món (tối đa ${allCombos.length}).`);
}

shuffleInPlace(allCombos);

const recipeBlueprints = allCombos.slice(0, RECIPE_COUNT).map(({ main, method, flavor }) => {
  const note = randomChoice(servingNotes);
  const name = `${main} ${method.label} ${flavor.label}`;
  const description = `Món ${main.toLowerCase()} ${method.description}, phủ ${flavor.label} ${flavor.description}. ${note}`;
  const image = `https://example.com/images/${slugify(name)}.jpg`;
  return { name, desc: description, image, main };
});

const units = ['g', 'ml', 'thìa', 'muỗng', 'nhúm', 'tép', 'miếng'];
const difficulties = ['easy', 'medium', 'hard'];

const recipeMainLookup = new Map();

const recipes = recipeBlueprints.map(({ name, desc, image, main }) => {
  const creator = randomChoice(users);
  const { created_at, updated_at } = nextTimestamp();
  const recipe = {
    id: nextId('recipes'),
    recipe_name: name,
    description: desc,
    image_url: image,
    prep_time: randomInt(10, 30),
    cook_time: randomInt(15, 45),
    servings: randomInt(2, 5),
    difficulty: randomChoice(difficulties),
    created_by: creator.id,
    status: 'visible',
    created_at,
    updated_at
  };
  recipeMainLookup.set(recipe.id, main);
  return recipe;
});

const recipeIngredients = [];

recipes.forEach((recipe) => {
  const count = randomInt(6, 9);
  const ingredientPool = [...ingredients];
  for (let i = 0; i < count && ingredientPool.length > 0; i++) {
    const idx = randomInt(0, ingredientPool.length - 1);
    const ingredient = ingredientPool.splice(idx, 1)[0];
    const { created_at, updated_at } = nextTimestamp();
    recipeIngredients.push({
      id: nextId('recipe_ingredients'),
      recipe_id: recipe.id,
      ingredient_id: ingredient.id,
      quantity: `${randomInt(1, 300)}`,
      unit: randomChoice(units),
      notes: '',
      created_at,
      updated_at
    });
  }
});

const stepTemplates = [
  'Sơ chế sạch {main}, thấm khô và cắt phần vừa ăn.',
  'Ướp {main} với muối, tiêu và một ít dầu oliu {mins} phút.',
  'Làm nóng chảo ở lửa vừa, cho tỏi băm vào phi thơm.',
  'Cho {main} vào nấu đến khi chín vàng, đảo đều tay.',
  'Thêm rau củ và nước mắm, rim thêm {mins} phút cho thấm vị.',
  'Nêm nếm lại cho vừa ăn rồi tắt bếp, rắc rau thơm.'
];

const recipeSteps = [];

recipes.forEach((recipe) => {
  const main = (recipeMainLookup.get(recipe.id) ?? recipe.recipe_name.split(' ')[0]).toLowerCase();
  const stepCount = randomInt(4, 6);
  for (let i = 1; i <= stepCount; i++) {
    const template = stepTemplates[i - 1];
    const mins = randomInt(3, 12);
    const { created_at, updated_at } = nextTimestamp();
    recipeSteps.push({
      id: nextId('recipe_steps'),
      recipe_id: recipe.id,
      step_number: i,
      instruction: template.replaceAll('{main}', main).replaceAll('{mins}', `${mins}`),
      image_url: '',
      created_at,
      updated_at
    });
  }
});

const userFavorites = [];

users.forEach((user) => {
  const favouriteCount = randomInt(1, 3);
  const pool = [...recipes];
  for (let i = 0; i < favouriteCount && pool.length > 0; i++) {
    const idx = randomInt(0, pool.length - 1);
    const recipe = pool.splice(idx, 1)[0];
    const { created_at, updated_at } = nextTimestamp();
    userFavorites.push({
      id: nextId('user_favorites'),
      user_id: user.id,
      recipe_id: recipe.id,
      created_at,
      updated_at
    });
  }
});

const recipeReviews = [];
const comments = [];

recipes.forEach((recipe) => {
  const reviewers = [...users].sort(() => Math.random() - 0.5).slice(0, randomInt(1, 3));
  reviewers.forEach((user, idx) => {
    const { created_at, updated_at } = nextTimestamp();
    recipeReviews.push({
      id: nextId('recipe_reviews'),
      user_id: user.id,
      recipe_id: recipe.id,
      rating: randomInt(4, 5),
      comment: 'Món ăn rất ngon và dễ làm!',
      is_active: 1,
      created_at,
      updated_at
    });
    const { created_at: cAt, updated_at: uAt } = nextTimestamp();
    comments.push({
      id: nextId('comments'),
      recipe_id: recipe.id,
      user_id: user.id,
      parent_id: null,
      content: idx === 0 ? 'Mình vừa thử và thành công ngay lần đầu!' : 'Cảm ơn vì công thức chi tiết.',
      is_edited: 0,
      edited_at: null,
      is_deleted: 0,
      deleted_at: null,
      like_count: randomInt(0, 12),
      reply_count: 0,
      created_at: cAt,
      updated_at: uAt
    });
  });
});

const pendingIngredients = [
  {
    ingredient_name: 'Lá chanh thái nhỏ',
    description: 'Gia vị thơm cho món hấp và nướng.',
    status: 'pending'
  },
  {
    ingredient_name: 'Muối hồng Himalaya',
    description: 'Muối khoáng tự nhiên, vị dịu.',
    status: 'approved'
  }
].map(({ ingredient_name, description, status }) => {
  const submitter = randomChoice(users);
  const reviewer = status === 'approved' ? randomChoice(admins) : null;
  const { created_at, updated_at } = nextTimestamp();
  return {
    id: nextId('pending_ingredients'),
    ingredient_name,
    submitted_by: submitter.id,
    status,
    created_at,
    updated_at,
    category_id: randomChoice(ingredientCategories).id,
    description,
    reviewed_by: reviewer ? reviewer.id : null,
    reviewed_at: reviewer ? updated_at : null,
    rejection_reason: status === 'rejected' ? 'Thông tin chưa đầy đủ.' : null
  };
});

const dataset = {
  ingredient_categories: ingredientCategories,
  ingredients,
  users,
  admins,
  recipes,
  recipe_ingredients: recipeIngredients,
  recipe_steps: recipeSteps,
  user_favorites: userFavorites,
  recipe_reviews: recipeReviews,
  comments,
  pending_ingredients: pendingIngredients
};

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const outputDir = path.join('Data', 'output', `schema-${timestamp}`);
fs.mkdirSync(outputDir, { recursive: true });

const jsonPath = path.join(outputDir, 'dataset.json');
fs.writeFileSync(jsonPath, JSON.stringify(dataset, null, 2), 'utf8');

const workbook = XLSX.utils.book_new();
const appendSheet = (data, sheetName) => {
  const worksheet = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
};

Object.entries(dataset).forEach(([key, value]) => {
  appendSheet(value, key);
});

const excelPath = path.join(outputDir, 'dataset.xlsx');
XLSX.writeFile(workbook, excelPath);

console.log('Dataset generated:');
console.log(`- JSON : ${jsonPath}`);
console.log(`- Excel: ${excelPath}`);
