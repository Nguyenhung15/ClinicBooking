-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: gateway01.ap-southeast-1.prod.aws.tidbcloud.com    Database: test
-- ------------------------------------------------------
-- Server version	8.0.11-TiDB-v8.5.3-serverless

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin`
--

DROP TABLE IF EXISTS `admin`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin` (
  `admin_id` bigint NOT NULL,
  PRIMARY KEY (`admin_id`) /*T![clustered_index] CLUSTERED */,
  KEY `FK5wu7m4u6dii7801jnfs4xqvfu` (`admin_id`),
  CONSTRAINT `FK5wu7m4u6dii7801jnfs4xqvfu` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin`
--

LOCK TABLES `admin` WRITE;
/*!40000 ALTER TABLE `admin` DISABLE KEYS */;
INSERT INTO `admin` VALUES (2),(3);
/*!40000 ALTER TABLE `admin` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `appointments`
--

DROP TABLE IF EXISTS `appointments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `appointments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `actual_end_time` time(6) DEFAULT NULL,
  `actual_start_time` time(6) DEFAULT NULL,
  `appointment_date` date DEFAULT NULL,
  `appointment_no` varchar(50) NOT NULL,
  `appointment_time` time(6) DEFAULT NULL,
  `checked_in` bit(1) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `join_code` varchar(255) DEFAULT NULL,
  `meeting_url` varchar(2000) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` enum('CANCELLED','CHECKED_IN','COMPLETED','CONFIRMED','EXPIRED','IN_PROGRESS','NO_SHOW','PENDING_CONFIRMATION','PENDING_PAYMENT','RESCHEDULED') DEFAULT NULL,
  `type` enum('OFFLINE','ONLINE') DEFAULT NULL,
  `confirmed_by` bigint DEFAULT NULL,
  `doctor_id` bigint DEFAULT NULL,
  `patient_id` bigint DEFAULT NULL,
  `shift_id` bigint DEFAULT NULL,
  `slot_id` bigint DEFAULT NULL,
  `specialty_id` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `UK5p4f5y4oosg55m0uqhfpsekin` (`appointment_no`),
  UNIQUE KEY `UK8y6yin1cflvk14414e91mdcwm` (`slot_id`),
  KEY `FKcgrij65povrjp56pg83e5qsqf` (`confirmed_by`),
  KEY `FKgpgce3qtc5fajyl4j5srcjkcf` (`doctor_id`),
  KEY `FKopb2h9yhin1rb4dqote8bws6w` (`patient_id`),
  KEY `FKm6a93yg7h52stest29cewght4` (`shift_id`),
  KEY `FKhn2k6wtscqwekhug3uj3sljod` (`specialty_id`),
  CONSTRAINT `FKcgrij65povrjp56pg83e5qsqf` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`),
  CONSTRAINT `FKgpgce3qtc5fajyl4j5srcjkcf` FOREIGN KEY (`doctor_id`) REFERENCES `doctor` (`doctor_id`),
  CONSTRAINT `FKopb2h9yhin1rb4dqote8bws6w` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FKm6a93yg7h52stest29cewght4` FOREIGN KEY (`shift_id`) REFERENCES `doctor_shifts` (`id`),
  CONSTRAINT `FK9ipdjuwvc0f6gdqopl0928eu4` FOREIGN KEY (`slot_id`) REFERENCES `shift_slots` (`id`),
  CONSTRAINT `FKhn2k6wtscqwekhug3uj3sljod` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=360001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `appointments`
--

LOCK TABLES `appointments` WRITE;
/*!40000 ALTER TABLE `appointments` DISABLE KEYS */;
INSERT INTO `appointments` VALUES (1,NULL,NULL,'2026-10-19','OFF60E56958','08:00:00.000000',_binary '','2026-10-18 07:44:37.640529',NULL,NULL,'đau dạ dày','CHECKED_IN','OFFLINE',120012,120002,1,1,1,1),(30003,NULL,NULL,'2026-10-19','OFFD072ECAA','13:00:00.000000',_binary '','2026-10-18 09:59:22.215362',NULL,NULL,NULL,'CHECKED_IN','OFFLINE',120012,120002,1,2,5,1),(90001,NULL,NULL,'2026-10-20','OFFB4C76CC7','13:00:00.000000',_binary '\0','2026-10-18 16:34:22.547120',NULL,NULL,NULL,'EXPIRED','OFFLINE',NULL,120003,1,30003,30009,5),(120001,NULL,NULL,'2026-10-22','OFFE72FC68D','08:00:00.000000',_binary '\0','2026-10-19 01:15:07.672897',NULL,NULL,NULL,'PENDING_CONFIRMATION','OFFLINE',NULL,120003,1,30006,30021,5),(120002,NULL,NULL,'2026-10-21','OFFEA1F96BD','13:00:00.000000',_binary '\0','2026-10-19 01:39:59.054528',NULL,NULL,NULL,'PENDING_CONFIRMATION','OFFLINE',NULL,120003,1,30004,30013,5),(120004,NULL,NULL,'2026-10-21','OFF0DAD9B8E','08:00:00.000000',_binary '\0','2026-10-19 01:54:32.851444',NULL,NULL,NULL,'EXPIRED','OFFLINE',NULL,120003,180001,30005,30017,5),(150002,NULL,NULL,'2026-10-19','OFF1600BE01','08:00:00.000000',_binary '','2026-10-19 09:44:24.845367',NULL,NULL,NULL,'CHECKED_IN','OFFLINE',120012,120003,180001,30001,30001,5),(210001,NULL,NULL,'2026-10-20','OFFA50D73E7','08:00:00.000000',_binary '\0','2026-10-19 15:21:30.115043',NULL,NULL,NULL,'EXPIRED','OFFLINE',NULL,120002,120001,3,9,1),(240001,NULL,NULL,'2026-10-22','OFF23EC0A91','08:00:00.000000',_binary '\0','2026-10-19 16:09:18.155078',NULL,NULL,NULL,'PENDING_CONFIRMATION','OFFLINE',NULL,120005,180001,60001,60001,3),(240002,NULL,NULL,'2026-10-22','OFFC6D39C8F','13:00:00.000000',_binary '','2026-10-19 16:10:23.209732',NULL,NULL,NULL,'CHECKED_IN','OFFLINE',120012,120005,1,60002,60005,3),(240003,NULL,NULL,'2026-10-21','OFF8FFF4755','08:00:00.000000',_binary '\0','2026-10-19 16:23:45.328171',NULL,NULL,NULL,'EXPIRED','OFFLINE',NULL,120005,1,60008,60023,3),(270003,NULL,NULL,'2026-10-22','OFFC13EF968','08:00:00.000000',_binary '\0','2026-10-20 17:08:11.854637',NULL,NULL,NULL,'PENDING_CONFIRMATION','OFFLINE',NULL,120006,180001,90005,90017,3),(300001,NULL,NULL,'2026-10-21','OFF63910B5F','08:00:00.000000',_binary '','2026-10-21 12:54:32.816197',NULL,NULL,NULL,'CHECKED_IN','OFFLINE',120012,120006,180001,90001,90001,3),(330001,NULL,NULL,'2026-10-27','OFF50F76728','08:00:00.000000',_binary '','2026-10-27 01:03:37.413412',NULL,NULL,NULL,'CHECKED_IN','OFFLINE',120012,120006,180001,120001,120001,3);
/*!40000 ALTER TABLE `appointments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor`
--

DROP TABLE IF EXISTS `doctor`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor` (
  `consultation_fee` double DEFAULT NULL,
  `degree` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `experience` varchar(255) DEFAULT NULL,
  `is_vip` bit(1) DEFAULT NULL,
  `doctor_id` bigint NOT NULL,
  `specialty_id` bigint NOT NULL,
  PRIMARY KEY (`doctor_id`) /*T![clustered_index] CLUSTERED */,
  KEY `FKswnadg5wwc5warkhiduusb3or` (`specialty_id`),
  KEY `FK2xjdo9fni5idymkv4lbw7eg7d` (`doctor_id`),
  CONSTRAINT `FKswnadg5wwc5warkhiduusb3or` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`),
  CONSTRAINT `FK2xjdo9fni5idymkv4lbw7eg7d` FOREIGN KEY (`doctor_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor`
--

LOCK TABLES `doctor` WRITE;
/*!40000 ALTER TABLE `doctor` DISABLE KEYS */;
INSERT INTO `doctor` VALUES (NULL,'BS CKII','Bác sĩ có kinh nghiệm khám và điều trị bệnh nội khoa, tim mạch và hồi sức cấp cứu.','26 năm tại Bệnh Viện Thiện Nhân; từng làm việc trong hồi sức cấp cứu, nội tim mạch và giữ chức Trưởng khoa Nội tổng hợp tại Hoàn Mỹ Đà Nẵng',_binary '\0',120002,1),(NULL,'Bác sĩ chuyên khoa II Nội tim mạch, Thạc sĩ; đào tạo tại Đại học Y Dược Huế.','Bác sĩ chuyên khám nội khoa và bệnh lý tim mạch, có kinh nghiệm trong cấp cứu và hồi sức tích cực.','Hơn 22 năm.',_binary '\0',120003,5),(NULL,'Tiến sĩ Y học Phục hồi chức năng; Thạc sĩ Vật lý trị liệu – Phục hồi chức năng.','Bác sĩ chuyên phục hồi chức năng cho các vấn đề về cơ, xương, khớp và thần kinh.','Hơn 8 năm Bệnh viện Vinmec Đà Nẵng',_binary '\0',120004,2),(NULL,'Tiến sĩ chuyên ngành Phẫu thuật hàm mặt.','Bác sĩ chuyên phẫu thuật hàm mặt, có kinh nghiệm khám chữa bệnh, đào tạo và nghiên cứu về implant, ghép xương và các bệnh lý hàm mặt.','Hơn 20 năm tại Bệnh viện Răng – Hàm – Mặt thành phố Đà Nẵng',_binary '\0',120005,3),(NULL,'Bác sĩ chuyên khoa II.','Bác sĩ Răng hàm mặt có kinh nghiệm lâu năm trong lĩnh vực nha khoa.','25 năm tại Nha khoa Doãn Bá Bình, Đà Nẵng',_binary '\0',120006,3),(NULL,'Bác sĩ chuyên khoa II; chứng nhận phẫu thuật viên Phaco.','Bác sĩ chuyên khám và điều trị bệnh lý mắt, có kinh nghiệm phẫu thuật đục thủy tinh thể và điều trị bệnh lý dịch kính – võng mạc.','40 năm theo hồ sơ bệnh viện Mắt Việt An Đà Nẵng',_binary '\0',120007,4),(NULL,'Thạc sĩ, Bác sĩ chuyên khoa II.','Bác sĩ chuyên khám và điều trị các bệnh lý mắt, đặc biệt là bệnh lý kết mạc và giác mạc.','40 năm theo hồ sơ bệnh viện Mắt Việt An Đà Nẵng',_binary '\0',120008,4),(NULL,'Bác sĩ chuyên khoa II; Thạc sĩ Phẫu thuật.','Bác sĩ Ngoại chấn thương chỉnh hình, có kinh nghiệm về thay khớp, nội soi khớp và phẫu thuật bàn tay.','Hơn 15 năm tại Bệnh viện Hoàn Mỹ Đà Nẵng',_binary '\0',120009,2),(NULL,'Bác sĩ chuyên khoa II Nội tim mạch; Thạc sĩ Tim mạch.','Bác sĩ chuyên điều trị và can thiệp bệnh lý tim mạch, có kinh nghiệm về động mạch vành và đặt máy tạo nhịp.','Hơn 15 năm tại Bệnh viện Hoàn Mỹ Đà Nẵng',_binary '\0',120010,5),(NULL,'Bác sĩ chuyên khoa II Tim mạch.','Bác sĩ chuyên khám và điều trị bệnh tim mạch, có kinh nghiệm về hồi sức cấp cứu, siêu âm tim và mạch máu.','25 năm tại Bệnh viện Đại học Y khoa Phan Châu Trinh',_binary '\0',120011,5);
/*!40000 ALTER TABLE `doctor` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `doctor_shifts`
--

DROP TABLE IF EXISTS `doctor_shifts`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `doctor_shifts` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `buffer_minutes` int DEFAULT NULL,
  `date` date DEFAULT NULL,
  `end_time` time(6) DEFAULT NULL,
  `max_patients` int DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `repeat_count` int DEFAULT NULL,
  `repeat_weekly` bit(1) DEFAULT NULL,
  `shift` enum('AFTERNOON','EVENING','MORNING') DEFAULT NULL,
  `slot_duration_minutes` int DEFAULT NULL,
  `start_time` time(6) DEFAULT NULL,
  `status` enum('ACTIVE','CANCELLED','GROUP_BLOCKED') DEFAULT NULL,
  `doctor_id` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `UKmrtxpnioa9s4i8a1stgf05l08` (`doctor_id`,`date`,`shift`),
  CONSTRAINT `FK5rcts6yxfwxefi0m1kgenlwd8` FOREIGN KEY (`doctor_id`) REFERENCES `doctor` (`doctor_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=150001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `doctor_shifts`
--

LOCK TABLES `doctor_shifts` WRITE;
/*!40000 ALTER TABLE `doctor_shifts` DISABLE KEYS */;
INSERT INTO `doctor_shifts` VALUES (1,15,'2026-10-19','12:00:00.000000',6,NULL,0,_binary '','MORNING',45,'08:00:00.000000','ACTIVE',120002),(2,15,'2026-10-19','17:00:00.000000',6,NULL,0,_binary '','AFTERNOON',45,'13:00:00.000000','ACTIVE',120002),(3,15,'2026-10-20','12:00:00.000000',6,NULL,0,_binary '','MORNING',45,'08:00:00.000000','ACTIVE',120002),(4,15,'2026-10-20','17:00:00.000000',6,NULL,0,_binary '','AFTERNOON',45,'13:00:00.000000','ACTIVE',120002),(30001,15,'2026-10-19','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120003),(30002,15,'2026-10-19','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120003),(30003,15,'2026-10-20','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120003),(30004,15,'2026-10-21','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120003),(30005,15,'2026-10-21','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120003),(30006,15,'2026-10-22','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120003),(60001,15,'2026-10-22','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120005),(60002,15,'2026-10-22','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120005),(60003,15,'2026-10-23','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120005),(60004,15,'2026-10-23','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120005),(60005,15,'2026-10-22','21:00:00.000000',10,NULL,0,_binary '\0','EVENING',45,'18:00:00.000000','ACTIVE',120005),(60006,15,'2026-10-23','21:00:00.000000',10,NULL,0,_binary '\0','EVENING',45,'18:00:00.000000','ACTIVE',120005),(60008,15,'2026-10-21','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120005),(60009,15,'2026-10-21','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120005),(90001,15,'2026-10-21','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120006),(90002,15,'2026-10-21','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120006),(90003,15,'2026-10-20','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120006),(90004,15,'2026-10-20','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120006),(90005,15,'2026-10-22','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120006),(90006,15,'2026-10-22','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120006),(90007,15,'2026-10-23','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120006),(90008,15,'2026-10-23','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120006),(90009,15,'2026-10-25','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120006),(90010,15,'2026-10-25','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120006),(90011,15,'2026-10-26','17:00:00.000000',10,NULL,0,_binary '\0','AFTERNOON',45,'13:00:00.000000','ACTIVE',120006),(90012,15,'2026-10-26','12:00:00.000000',10,NULL,0,_binary '\0','MORNING',45,'08:00:00.000000','ACTIVE',120006),(120001,15,'2026-10-27','12:00:00.000000',6,NULL,0,_binary '','MORNING',45,'08:00:00.000000','ACTIVE',120006),(120002,15,'2026-10-27','17:00:00.000000',6,NULL,0,_binary '','AFTERNOON',45,'13:00:00.000000','ACTIVE',120006),(120003,15,'2026-10-28','12:00:00.000000',6,NULL,0,_binary '','MORNING',45,'08:00:00.000000','ACTIVE',120006),(120004,15,'2026-10-28','17:00:00.000000',6,NULL,0,_binary '','AFTERNOON',45,'13:00:00.000000','ACTIVE',120006);
/*!40000 ALTER TABLE `doctor_shifts` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `events`
--

DROP TABLE IF EXISTS `events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `description` varchar(255) DEFAULT NULL,
  `end_date` datetime(6) NOT NULL,
  `is_enabled` bit(1) NOT NULL,
  `location` varchar(255) DEFAULT NULL,
  `start_date` datetime(6) NOT NULL,
  `title` varchar(255) NOT NULL,
  `voucher_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FKk2dmr4uuqp3cd36bf1vobxmne` (`voucher_id`),
  CONSTRAINT `FKk2dmr4uuqp3cd36bf1vobxmne` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `events`
--

LOCK TABLES `events` WRITE;
/*!40000 ALTER TABLE `events` DISABLE KEYS */;
INSERT INTO `events` VALUES (1,'Khi khám tại phòng khám vào ngày 20-11, khách hàng nữ sẽ được ưu đãi tới 20% với tất cả các dịch vụ khám trực tiếp','2026-10-20 23:59:00.000000',_binary '','123 Nguyễn Văn Linh, Hải Châu, TP. Đà Nẵng','2026-10-20 00:00:00.000000','Tri ân khách hàng',1);
/*!40000 ALTER TABLE `events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `feedbacks`
--

DROP TABLE IF EXISTS `feedbacks`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `feedbacks` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `admin_responded_at` datetime(6) DEFAULT NULL,
  `admin_response` text DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `comment` text NOT NULL,
  `created_at` datetime(6) NOT NULL,
  `is_anonymous` bit(1) NOT NULL,
  `rating` int NOT NULL,
  `status` varchar(50) DEFAULT NULL,
  `title` varchar(255) DEFAULT NULL,
  `updated_at` datetime(6) DEFAULT NULL,
  `user_id` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FK312drfl5lquu37mu4trk8jkwx` (`user_id`),
  CONSTRAINT `FK312drfl5lquu37mu4trk8jkwx` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=60001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `feedbacks`
--

LOCK TABLES `feedbacks` WRITE;
/*!40000 ALTER TABLE `feedbacks` DISABLE KEYS */;
INSERT INTO `feedbacks` VALUES (1,NULL,NULL,'Chất lượng khám chữa bệnh','Nhiều voucher hơn nhé','2026-10-26 03:08:10.119909',_binary '\0',5,'APPROVED','Phòng khám hiện đại và sạch sẽ','2026-10-26 03:08:10.119971',180001),(30001,NULL,NULL,'Chất lượng khám chữa bệnh','phòng khám sạch sẽ, thiết bị hiện đại, bác sĩ tận tâm, hỗ trợ hết mình','2026-10-26 14:19:57.382349',_binary '\0',5,'APPROVED','','2026-10-26 14:28:10.817495',240002),(30002,NULL,NULL,'Chất lượng khám chữa bệnh','cơ sở vật chất thiết bị hiện đại, không gian sạch sẽ, không khí thoáng mát, bác sĩ nhiệt tình, sẵn sàng tin tưởng cho các lần tái khám sau','2026-10-26 14:29:24.577087',_binary '',5,'APPROVED','Đánh giá từ bệnh nhân','2026-10-26 14:29:24.577107',240003),(30003,NULL,NULL,'Chất lượng khám chữa bệnh','Phòng khám sạch sẽ bác sĩ nhiệt tình','2026-10-26 14:34:22.901424',_binary '',5,'APPROVED','','2026-10-26 14:34:22.901439',240006),(30004,NULL,NULL,'Chất lượng khám chữa bệnh','Mình có trải nghiệm rất tốt tại phòng khám. Không gian sạch sẽ, thoáng và tạo cảm giác thoải mái. Nhân viên tiếp đón lịch sự, nhiệt tình và hướng dẫn rất rõ ràng. Bác sĩ thăm khám cẩn thận, tư vấn tận tình và giải đáp các thắc mắc một cách dễ hiểu. Quy trình làm việc chuyên nghiệp, mọi người đều thân thiện và chu đáo. Nhìn chung mình rất hài lòng với chất lượng dịch vụ tại đây và sẽ cân nhắc quay lại khi cần.','2026-10-26 14:37:05.291938',_binary '\0',5,'APPROVED','Phòng khám rất tốt và chu đáo','2026-10-26 14:37:05.291949',240005),(30005,NULL,NULL,'Thái độ nhân viên & Y bác sĩ','Hỗ trợ nhiệt tình, cơ sở sạch sẽ','2026-10-26 14:42:16.476081',_binary '\0',5,'APPROVED','Tốt','2026-10-26 14:42:16.476093',240004),(30006,NULL,NULL,'Chất lượng khám chữa bệnh','thái độ quá tốt','2026-10-26 14:49:58.282414',_binary '\0',5,'APPROVED','ân cần','2026-10-26 14:49:58.282426',240007);
/*!40000 ALTER TABLE `feedbacks` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `group_health_assignments`
--

DROP TABLE IF EXISTS `group_health_assignments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_health_assignments` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `capacity_allocated` int DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `result_file_path` varchar(255) DEFAULT NULL,
  `result_status` enum('APPROVED','NONE','REJECTED','UPLOADED') DEFAULT NULL,
  `doctor_id` bigint DEFAULT NULL,
  `request_id` bigint DEFAULT NULL,
  `shift_id` bigint DEFAULT NULL,
  `specialty_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `UKtixliy5w36tegfckl2jj37vxh` (`request_id`,`doctor_id`,`shift_id`,`specialty_id`),
  KEY `FKji9pru48gyba2754yewfa1pox` (`doctor_id`),
  KEY `FK4pvkab6rpgoyqxddrbvyrx8d` (`shift_id`),
  KEY `FKhlcdm83e9rj2j6ra6eqma6t21` (`specialty_id`),
  CONSTRAINT `FKji9pru48gyba2754yewfa1pox` FOREIGN KEY (`doctor_id`) REFERENCES `doctor` (`doctor_id`),
  CONSTRAINT `FKhhamrqh2a12t2xnsmfgqyd1cm` FOREIGN KEY (`request_id`) REFERENCES `group_health_request` (`id`),
  CONSTRAINT `FK4pvkab6rpgoyqxddrbvyrx8d` FOREIGN KEY (`shift_id`) REFERENCES `doctor_shifts` (`id`),
  CONSTRAINT `FKhlcdm83e9rj2j6ra6eqma6t21` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `group_health_assignments`
--

LOCK TABLES `group_health_assignments` WRITE;
/*!40000 ALTER TABLE `group_health_assignments` DISABLE KEYS */;
/*!40000 ALTER TABLE `group_health_assignments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `group_health_request`
--

DROP TABLE IF EXISTS `group_health_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `group_health_request` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `departments` varchar(255) DEFAULT NULL,
  `excel_file_path` varchar(255) DEFAULT NULL,
  `group_name` varchar(255) DEFAULT NULL,
  `phone_number` varchar(255) DEFAULT NULL,
  `preferred_date` date DEFAULT NULL,
  `status` enum('APPROVED','COMPLETED','PENDING','REJECTED') DEFAULT NULL,
  `created_by` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FKtk0y748vqpnw2m87611vd70rt` (`created_by`),
  CONSTRAINT `FKtk0y748vqpnw2m87611vd70rt` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `group_health_request`
--

LOCK TABLES `group_health_request` WRITE;
/*!40000 ALTER TABLE `group_health_request` DISABLE KEYS */;
/*!40000 ALTER TABLE `group_health_request` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `images`
--

DROP TABLE IF EXISTS `images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `images` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `image_url` varchar(5000) DEFAULT NULL,
  `doctor_id` bigint DEFAULT NULL,
  `specialty_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FK43f8s6jcl2cshw84x3wtnd94c` (`doctor_id`),
  KEY `FKr5fvvlbp4ohawroxxtsfr4p6p` (`specialty_id`),
  CONSTRAINT `FK43f8s6jcl2cshw84x3wtnd94c` FOREIGN KEY (`doctor_id`) REFERENCES `doctor` (`doctor_id`),
  CONSTRAINT `FKr5fvvlbp4ohawroxxtsfr4p6p` FOREIGN KEY (`specialty_id`) REFERENCES `specialties` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `images`
--

LOCK TABLES `images` WRITE;
/*!40000 ALTER TABLE `images` DISABLE KEYS */;
/*!40000 ALTER TABLE `images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `news`
--

DROP TABLE IF EXISTS `news`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `news` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `image` varchar(255) DEFAULT NULL,
  `link` varchar(255) DEFAULT NULL,
  `pub_date` datetime(6) DEFAULT NULL,
  `summary` longtext DEFAULT NULL,
  `title` varchar(200) NOT NULL,
  `source_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FK5sv1q9ts9ag97cter4ncymlp7` (`source_id`),
  CONSTRAINT `FK5sv1q9ts9ag97cter4ncymlp7` FOREIGN KEY (`source_id`) REFERENCES `rss_sources` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `news`
--

LOCK TABLES `news` WRITE;
/*!40000 ALTER TABLE `news` DISABLE KEYS */;
/*!40000 ALTER TABLE `news` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient`
--

DROP TABLE IF EXISTS `patient`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient` (
  `patient_id` bigint NOT NULL,
  PRIMARY KEY (`patient_id`) /*T![clustered_index] CLUSTERED */,
  KEY `FKb0b0n91318hwrvx0lmf19pfuv` (`patient_id`),
  CONSTRAINT `FKb0b0n91318hwrvx0lmf19pfuv` FOREIGN KEY (`patient_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient`
--

LOCK TABLES `patient` WRITE;
/*!40000 ALTER TABLE `patient` DISABLE KEYS */;
INSERT INTO `patient` VALUES (1),(30001),(60001),(60002),(60003),(90001),(120001),(150001),(180001),(210001),(240001),(240002),(240003),(240004),(240005),(240006),(240007);
/*!40000 ALTER TABLE `patient` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `patient_information`
--

DROP TABLE IF EXISTS `patient_information`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `patient_information` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `address` varchar(255) DEFAULT NULL,
  `dob` varchar(255) DEFAULT NULL,
  `full_name` varchar(255) DEFAULT NULL,
  `gender` varchar(255) DEFAULT NULL,
  `phone_number` varchar(255) DEFAULT NULL,
  `relationship` varchar(255) DEFAULT NULL,
  `appointment_id` bigint DEFAULT NULL,
  `owner_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FK3q7xfxm6p8k2ebdq6mycfbs51` (`appointment_id`),
  KEY `FKl3yd4h54w7v034yk2p04jai4c` (`owner_id`),
  CONSTRAINT `FK3q7xfxm6p8k2ebdq6mycfbs51` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`),
  CONSTRAINT `FKl3yd4h54w7v034yk2p04jai4c` FOREIGN KEY (`owner_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=150001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `patient_information`
--

LOCK TABLES `patient_information` WRITE;
/*!40000 ALTER TABLE `patient_information` DISABLE KEYS */;
INSERT INTO `patient_information` VALUES (1,NULL,'2004-11-06','Huy Quoc','Male','0396975611',NULL,240003,1),(30001,NULL,'2005-11-11','Tô Đát Kỷ','Female','0976522817','Vợ',120001,1),(60001,NULL,'2004-11-06','Bin','Male','1234567890','bản thân',330001,180001),(90001,NULL,'2005-06-08','Đặng Hải Anh','Male','035206085','Bạn bè',210001,120001),(120001,NULL,'1990-11-06','Sơn Tùng','Male','1234567890','ae',330001,180001);
/*!40000 ALTER TABLE `patient_information` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `payment_transactions`
--

DROP TABLE IF EXISTS `payment_transactions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `payment_transactions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `amount` varchar(255) DEFAULT NULL,
  `bank_code` varchar(255) DEFAULT NULL,
  `order_info` varchar(255) DEFAULT NULL,
  `pay_date` datetime(6) DEFAULT NULL,
  `response_code` varchar(255) DEFAULT NULL,
  `transaction_no` varchar(255) DEFAULT NULL,
  `transaction_status` varchar(255) DEFAULT NULL,
  `appointment_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FKlt7moudhgt2jd0pbxiq8739bw` (`appointment_id`),
  CONSTRAINT `FKlt7moudhgt2jd0pbxiq8739bw` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `payment_transactions`
--

LOCK TABLES `payment_transactions` WRITE;
/*!40000 ALTER TABLE `payment_transactions` DISABLE KEYS */;
/*!40000 ALTER TABLE `payment_transactions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `prescriptions`
--

DROP TABLE IF EXISTS `prescriptions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `prescriptions` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `dosage` varchar(255) DEFAULT NULL,
  `duration` varchar(255) DEFAULT NULL,
  `instructions` varchar(255) DEFAULT NULL,
  `medicine_name` varchar(255) NOT NULL,
  `appointment_id` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FKe2fpvlkkcgcd40k4ufyyju2al` (`appointment_id`),
  CONSTRAINT `FKe2fpvlkkcgcd40k4ufyyju2al` FOREIGN KEY (`appointment_id`) REFERENCES `appointments` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `prescriptions`
--

LOCK TABLES `prescriptions` WRITE;
/*!40000 ALTER TABLE `prescriptions` DISABLE KEYS */;
/*!40000 ALTER TABLE `prescriptions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `receptionist`
--

DROP TABLE IF EXISTS `receptionist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `receptionist` (
  `receptionist_id` bigint NOT NULL,
  PRIMARY KEY (`receptionist_id`) /*T![clustered_index] CLUSTERED */,
  KEY `FKakou8n8hl0fcyfwlg3u0988md` (`receptionist_id`),
  CONSTRAINT `FKakou8n8hl0fcyfwlg3u0988md` FOREIGN KEY (`receptionist_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `receptionist`
--

LOCK TABLES `receptionist` WRITE;
/*!40000 ALTER TABLE `receptionist` DISABLE KEYS */;
INSERT INTO `receptionist` VALUES (120012);
/*!40000 ALTER TABLE `receptionist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `rss_sources`
--

DROP TABLE IF EXISTS `rss_sources`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `rss_sources` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `category` varchar(50) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `name` varchar(100) NOT NULL,
  `status` enum('active','inactive') DEFAULT NULL,
  `url` varchar(255) NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `UK50aq3mu8h0wckod2totilr98x` (`url`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `rss_sources`
--

LOCK TABLES `rss_sources` WRITE;
/*!40000 ALTER TABLE `rss_sources` DISABLE KEYS */;
/*!40000 ALTER TABLE `rss_sources` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_cancel_request`
--

DROP TABLE IF EXISTS `shift_cancel_request`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_cancel_request` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `approved_at` datetime(6) DEFAULT NULL,
  `created_at` datetime(6) DEFAULT NULL,
  `note` varchar(255) DEFAULT NULL,
  `reason` varchar(255) DEFAULT NULL,
  `status` enum('APPROVED','PENDING','REJECTED') DEFAULT NULL,
  `approved_by` bigint DEFAULT NULL,
  `doctor_id` bigint DEFAULT NULL,
  `shift_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FK6sdttqil87i4j7ubydjdrmqd4` (`approved_by`),
  KEY `FK83jas5xmcxbof51r6dvrbcyn6` (`doctor_id`),
  KEY `FKhdn2oq01mvcepj4kq582frm8x` (`shift_id`),
  CONSTRAINT `FK6sdttqil87i4j7ubydjdrmqd4` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`),
  CONSTRAINT `FK83jas5xmcxbof51r6dvrbcyn6` FOREIGN KEY (`doctor_id`) REFERENCES `doctor` (`doctor_id`),
  CONSTRAINT `FKhdn2oq01mvcepj4kq582frm8x` FOREIGN KEY (`shift_id`) REFERENCES `doctor_shifts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_cancel_request`
--

LOCK TABLES `shift_cancel_request` WRITE;
/*!40000 ALTER TABLE `shift_cancel_request` DISABLE KEYS */;
/*!40000 ALTER TABLE `shift_cancel_request` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `shift_slots`
--

DROP TABLE IF EXISTS `shift_slots`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `shift_slots` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `end_time` time(6) DEFAULT NULL,
  `slot_number` int DEFAULT NULL,
  `start_time` time(6) DEFAULT NULL,
  `status` enum('AVAILABLE','BOOKED','CANCELLED','COMPLETED') DEFAULT NULL,
  `shift_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FKr4ya5q92m5xlqukyiwqbrso26` (`shift_id`),
  CONSTRAINT `FKr4ya5q92m5xlqukyiwqbrso26` FOREIGN KEY (`shift_id`) REFERENCES `doctor_shifts` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=150001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `shift_slots`
--

LOCK TABLES `shift_slots` WRITE;
/*!40000 ALTER TABLE `shift_slots` DISABLE KEYS */;
INSERT INTO `shift_slots` VALUES (1,'08:45:00.000000',1,'08:00:00.000000','BOOKED',1),(2,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',1),(3,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',1),(4,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',1),(5,'13:45:00.000000',1,'13:00:00.000000','BOOKED',2),(6,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',2),(7,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',2),(8,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',2),(9,'08:45:00.000000',1,'08:00:00.000000','BOOKED',3),(10,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',3),(11,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',3),(12,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',3),(13,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',4),(14,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',4),(15,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',4),(16,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',4),(30001,'08:45:00.000000',1,'08:00:00.000000','BOOKED',30001),(30002,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',30001),(30003,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',30001),(30004,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',30001),(30005,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',30002),(30006,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',30002),(30007,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',30002),(30008,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',30002),(30009,'13:45:00.000000',1,'13:00:00.000000','BOOKED',30003),(30010,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',30003),(30011,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',30003),(30012,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',30003),(30013,'13:45:00.000000',1,'13:00:00.000000','BOOKED',30004),(30014,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',30004),(30015,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',30004),(30016,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',30004),(30017,'08:45:00.000000',1,'08:00:00.000000','BOOKED',30005),(30018,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',30005),(30019,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',30005),(30020,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',30005),(30021,'08:45:00.000000',1,'08:00:00.000000','BOOKED',30006),(30022,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',30006),(30023,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',30006),(30024,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',30006),(60001,'08:45:00.000000',1,'08:00:00.000000','BOOKED',60001),(60002,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',60001),(60003,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',60001),(60004,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',60001),(60005,'13:45:00.000000',1,'13:00:00.000000','BOOKED',60002),(60006,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',60002),(60007,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',60002),(60008,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',60002),(60009,'08:45:00.000000',1,'08:00:00.000000','AVAILABLE',60003),(60010,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',60003),(60011,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',60003),(60012,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',60003),(60013,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',60004),(60014,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',60004),(60015,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',60004),(60016,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',60004),(60017,'18:45:00.000000',1,'18:00:00.000000','AVAILABLE',60005),(60018,'19:45:00.000000',2,'19:00:00.000000','AVAILABLE',60005),(60019,'20:45:00.000000',3,'20:00:00.000000','AVAILABLE',60005),(60020,'18:45:00.000000',1,'18:00:00.000000','AVAILABLE',60006),(60021,'19:45:00.000000',2,'19:00:00.000000','AVAILABLE',60006),(60022,'20:45:00.000000',3,'20:00:00.000000','AVAILABLE',60006),(60023,'08:45:00.000000',1,'08:00:00.000000','BOOKED',60008),(60024,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',60008),(60025,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',60008),(60026,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',60008),(60027,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',60009),(60028,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',60009),(60029,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',60009),(60030,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',60009),(90001,'08:45:00.000000',1,'08:00:00.000000','BOOKED',90001),(90002,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',90001),(90003,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',90001),(90004,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',90001),(90005,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',90002),(90006,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',90002),(90007,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',90002),(90008,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',90002),(90009,'08:45:00.000000',1,'08:00:00.000000','AVAILABLE',90003),(90010,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',90003),(90011,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',90003),(90012,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',90003),(90013,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',90004),(90014,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',90004),(90015,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',90004),(90016,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',90004),(90017,'08:45:00.000000',1,'08:00:00.000000','BOOKED',90005),(90018,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',90005),(90019,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',90005),(90020,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',90005),(90021,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',90006),(90022,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',90006),(90023,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',90006),(90024,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',90006),(90025,'08:45:00.000000',1,'08:00:00.000000','AVAILABLE',90007),(90026,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',90007),(90027,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',90007),(90028,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',90007),(90029,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',90008),(90030,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',90008),(90031,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',90008),(90032,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',90008),(90033,'08:45:00.000000',1,'08:00:00.000000','AVAILABLE',90009),(90034,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',90009),(90035,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',90009),(90036,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',90009),(90037,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',90010),(90038,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',90010),(90039,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',90010),(90040,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',90010),(90041,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',90011),(90042,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',90011),(90043,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',90011),(90044,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',90011),(90045,'08:45:00.000000',1,'08:00:00.000000','AVAILABLE',90012),(90046,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',90012),(90047,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',90012),(90048,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',90012),(120001,'08:45:00.000000',1,'08:00:00.000000','BOOKED',120001),(120002,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',120001),(120003,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',120001),(120004,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',120001),(120005,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',120002),(120006,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',120002),(120007,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',120002),(120008,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',120002),(120009,'08:45:00.000000',1,'08:00:00.000000','AVAILABLE',120003),(120010,'09:45:00.000000',2,'09:00:00.000000','AVAILABLE',120003),(120011,'10:45:00.000000',3,'10:00:00.000000','AVAILABLE',120003),(120012,'11:45:00.000000',4,'11:00:00.000000','AVAILABLE',120003),(120013,'13:45:00.000000',1,'13:00:00.000000','AVAILABLE',120004),(120014,'14:45:00.000000',2,'14:00:00.000000','AVAILABLE',120004),(120015,'15:45:00.000000',3,'15:00:00.000000','AVAILABLE',120004),(120016,'16:45:00.000000',4,'16:00:00.000000','AVAILABLE',120004);
/*!40000 ALTER TABLE `shift_slots` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `specialties`
--

DROP TABLE IF EXISTS `specialties`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `specialties` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `description` text DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `UKbhb8s9o5hv30lkbidtod9cixc` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `specialties`
--

LOCK TABLES `specialties` WRITE;
/*!40000 ALTER TABLE `specialties` DISABLE KEYS */;
INSERT INTO `specialties` VALUES (1,'Thăm khám và đánh giá sức khỏe toàn diện, hỗ trợ nhận biết các vấn đề thường gặp như mệt mỏi, sốt, đau đầu hoặc rối loạn tiêu hóa. Bác sĩ tư vấn chăm sóc sức khỏe, theo dõi bệnh lý và định hướng khám chuyên khoa phù hợp khi cần thiết.','Nội tổng quát'),(2,'Thăm khám các vấn đề liên quan đến cơ, xương, khớp và cột sống như đau lưng, đau vai gáy, đau khớp hoặc hạn chế vận động. Bác sĩ đánh giá tình trạng, tư vấn hướng điều trị và chế độ vận động phù hợp với từng người bệnh.','Cơ Xương Khớp'),(3,'Thăm khám các vấn đề về răng, nướu và vùng hàm mặt như sâu răng, viêm nướu, ê buốt hoặc đau nhức răng. Bác sĩ tư vấn hướng xử lý phù hợp và hướng dẫn vệ sinh, chăm sóc răng miệng để duy trì sức khỏe lâu dài.','Răng Hàm Mặt'),(4,'Kiểm tra thị lực và thăm khám các vấn đề như nhìn mờ, khô mắt, mỏi mắt hoặc khó chịu ở mắt. Bác sĩ đánh giá tình trạng, tư vấn hướng xử lý và cách chăm sóc đôi mắt phù hợp với độ tuổi, công việc và thói quen sinh hoạt.','Mắt'),(5,'Thăm khám và theo dõi sức khỏe tim mạch, đánh giá các vấn đề liên quan đến huyết áp, nhịp tim và tuần hoàn. Bác sĩ tư vấn kiểm soát các yếu tố nguy cơ, duy trì lối sống phù hợp và xây dựng kế hoạch theo dõi theo tình trạng sức khỏe của từng người.','Tim mạch');
/*!40000 ALTER TABLE `specialties` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_events`
--

DROP TABLE IF EXISTS `user_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_events` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `registered_at` datetime(6) DEFAULT NULL,
  `status` enum('CONFIRMED','PENDING') DEFAULT NULL,
  `event_id` bigint DEFAULT NULL,
  `user_id` bigint DEFAULT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FKqh8jukuil4jkihri1o262hik7` (`event_id`),
  KEY `FKg3rv1yxrs56ohyn30rlt7vum7` (`user_id`),
  CONSTRAINT `FKqh8jukuil4jkihri1o262hik7` FOREIGN KEY (`event_id`) REFERENCES `events` (`id`),
  CONSTRAINT `FKg3rv1yxrs56ohyn30rlt7vum7` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_events`
--

LOCK TABLES `user_events` WRITE;
/*!40000 ALTER TABLE `user_events` DISABLE KEYS */;
INSERT INTO `user_events` VALUES (1,'2026-10-20 17:26:37.788404','PENDING',1,180001);
/*!40000 ALTER TABLE `user_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_vouchers`
--

DROP TABLE IF EXISTS `user_vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_vouchers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `issued_at` datetime(6) NOT NULL,
  `used` bit(1) NOT NULL,
  `user_id` bigint NOT NULL,
  `voucher_id` bigint NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  KEY `FK90ahc2var0yrghyxr9tapdokg` (`user_id`),
  KEY `FK40ig7khk2v79rbqaj98mf1g2q` (`voucher_id`),
  CONSTRAINT `FK90ahc2var0yrghyxr9tapdokg` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`),
  CONSTRAINT `FK40ig7khk2v79rbqaj98mf1g2q` FOREIGN KEY (`voucher_id`) REFERENCES `vouchers` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_vouchers`
--

LOCK TABLES `user_vouchers` WRITE;
/*!40000 ALTER TABLE `user_vouchers` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_vouchers` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `created_at` datetime(6) DEFAULT NULL,
  `email` varchar(255) NOT NULL,
  `full_name` varchar(255) NOT NULL,
  `gender` varchar(255) DEFAULT NULL,
  `is_enable` bit(1) NOT NULL,
  `password` varchar(255) NOT NULL,
  `phone_number` varchar(255) DEFAULT NULL,
  `user_type` varchar(255) NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `UK6dotkott2kjsp8vw4d0m25fb7` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=270001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'2026-10-16 16:46:02.299499','miraisan2512@gmail.com','Huy Quoc','Male',_binary '','$2a$10$fF0Wk1ZthzjolAJKiXSGreTrXPO6vtC.DHxUipmJ4T0nP9LAHwPYy','396975611','Patient'),(2,'2026-10-16 17:00:10.041271','admin@clinicbooking.com','Admin System','OTHER',_binary '','$2a$10$RIc7e743Jicpu6F0abZulusDVTuTPR7nan2ULue1XZ1ZtXN821.SG','0988888888','Admin'),(3,'2026-10-16 17:16:27.878014','testadmin@clinicbooking.com','Test Admin','OTHER',_binary '','$2a$10$pT0crvde5atwBIKl8uU98uX9HMnmnyeyIz2xw3n1a/ZRKENSQxV.6','0912345678','Admin'),(30001,'2026-10-17 02:30:08.011767','dovudn2015@gmail.com','Đỗ Anh Vũ','OTHER',_binary '','$2a$10$WZNtar3iU71LuHuUM2hAiOgn8dEQ/Z0PHSn5A5jJUZdxcwZA7OGWa','0778622183','Patient'),(60001,'2026-10-17 04:42:23.607295','nhiht6767@gmail.com','Hoàng Thị Nhi','OTHER',_binary '','$2a$10$TlkiLd9YO4rpF2pz6rohEeWG0J866N.dT1lNsV/lNY2OWFU2bQm8u','0982765672','Patient'),(60002,'2026-10-17 04:42:23.606053','A@gmail.com','Nguyễn Văn A','OTHER',_binary '','$2a$10$zYnKN3SeTTtmBFemB2/3UuA8W.OhdRKZYG8L.RbNaEcDCRd9I5JGG','0974493636','Patient'),(60003,'2026-10-17 06:22:54.254846','huynhqhe189004@fpt.edu.vn','Nguyen Hoang Quoc Huy (K18 HL)',NULL,_binary '','{noop}GOOGLE_LOGIN',NULL,'Patient'),(90001,'2026-10-17 09:23:54.688281','manhlyabc2005@gmail.com','Đức Mạnh','OTHER',_binary '','$2a$10$qBz78qH3SkcaFzZg/GwTSu5STHrLnqsqtJeYDe73bFt8txLNfTxMi','0796744735','Patient'),(120001,'2026-10-18 06:36:45.481700','danghaianh10a7@gmail.com','Đặng Hải Anh',NULL,_binary '','{noop}GOOGLE_LOGIN',NULL,'Patient'),(120002,'2026-10-18 07:08:25.900965','bacsi.demo01@example.com','Tôn Thất Việt Hùng','Male',_binary '','$2a$10$ZBbGXvdXkzbQbM05id.kHO4p7g5YhlVdcwKyXg55EIwKxyN/cMdJW','0000000001','Doctor'),(120003,'2026-10-18 07:13:44.531127','bacsi.demo02@example.com','Lâm Trọng Cơ','Male',_binary '','$2a$10$6YayHhsDxQKoZisilmelZ.8RJNhU0Y1xf54sVEKDBE/Ayfu0UKXo6','0000000002','Doctor'),(120004,'2026-10-18 07:15:49.436684','bacsi.demo04@example.com','Đoàn Thành Nhân','Male',_binary '','$2a$10$Y44k2FdgKE8/5nVGaNPTUectKuBVwiOjHd/I0Tm6t77N/OEGcgGLW','0000000004','Doctor'),(120005,'2026-10-18 07:18:09.026328','bacsi.demo05@example.com','Nguyễn Quang Hải','Male',_binary '','$2a$10$f9nQ5I8wU0RUWmpikeYrIOfIiRuEy0v/r.wGQO91kUCtYmjgYD94u','0000000005','Doctor'),(120006,'2026-10-18 07:19:25.994812','bacsi.demo06@example.com','Doãn Bá Bình','Male',_binary '','$2a$10$IdcqELsz4ONpBPNi3rhxOeV6Hqom9PInpD8A7X5StJKg3ic4..cBi','0000000006','Doctor'),(120007,'2026-10-18 07:20:52.001177','bacsi.demo07@example.com','Trần Văn Đà','Male',_binary '','$2a$10$8rokuRtmIHsKtrUyzOkR5uluwJNqFg05DP2SuYwqOWP.ISEqcjYgC','0000000007','Doctor'),(120008,'2026-10-18 07:21:59.665701','bacsi.demo08@example.com','Nguyễn Thị Thu','Female',_binary '','$2a$10$yTm.RMrUnBKOZdx4Ftir4ebf19PzATawzsZgTHDYrx2v/uiGcFgqa','0000000008','Doctor'),(120009,'2026-10-18 07:24:19.065487','bacsi.demo03@example.com','Hà Nguyễn Minh Quang','Male',_binary '','$2a$10$dMoYbBJOtglFO5q36zPDpuQP0XTlZ3Ubn3ewu1yRZ1jWSeFFVkHRK','0000000003','Doctor'),(120010,'2026-10-18 07:26:21.288019','bacsi.demo09@example.com','Huỳnh Thúc Bảo','Male',_binary '','$2a$10$omiRFTUXxREa6GbR1.Y9YOSo2w2WvM34hgtOCEPWFpIBzcywtpPQy','0000000009','Doctor'),(120011,'2026-10-18 07:27:40.101203','bacsi.demo10@example.com','Lê Xuân Túy','Male',_binary '','$2a$10$tHEL81WyN5XF9WxGlyQOou4qMsWy0KntNu8vr8iseRFwgb8CknSDm','0000000010','Doctor'),(120012,'2026-10-18 07:46:59.009102','receptionist1@gmail.com','Võ Mai Phương','Female',_binary '','$2a$10$r3MK5MPRyPGkJU3f1U9oDeDehK7PqMuvPppufruEoUbJaNPumBswK','1234567890','Receptionist'),(150001,'2026-10-18 09:34:12.324058','khanhlinhnguyentran2004@gmail.com','Nguyễn Trần Khánh Linh',NULL,_binary '','{noop}GOOGLE_LOGIN',NULL,'Patient'),(180001,'2026-10-19 01:53:14.488724','binnoob1@gmail.com','Bin','OTHER',_binary '','$2a$10$biwzlypRabAMMgnck8ouuOEd1.31qqAyz3M1moVPadRANH6DjdF/C','1234567890','Patient'),(210001,'2026-10-19 10:11:11.538525','haianh682005@gmail.com','JackyKtr','OTHER',_binary '','$2a$10$8eIrCzWApH9vl2xonjO4de5oYgPRmZFqoZDw8D96lrVV9uoeftrSi','0352060805','Patient'),(240001,'2026-10-26 14:17:56.908386','chimbu@gmail.com','cặc trâu to','OTHER',_binary '','$2a$10$R930jg2rHLQCyyg.Di7rnOC5gKT8ElrQ72oW8hpEaaM.WTiLpXBfi','1234567890','Patient'),(240002,'2026-10-26 14:17:59.035503','vyh23306@gmail.com','Phùng Thị Hoàng Vy ','OTHER',_binary '','$2a$10$qfH5M78386CMNsBu1UD1yePf9SOXFgvnvTCwdAHwkKG5Xx3eEnIru','0795176321','Patient'),(240003,'2026-10-26 14:20:28.394167','ll5127754@gmail.com','Lê Nguyễn Trang Linh','OTHER',_binary '','$2a$10$0SZ78Iw7t2/UBTF2OnHyxeovx0pIswnMjK6Nq1bcC9KC6nt8IzU5a','0982870950','Patient'),(240004,'2026-10-26 14:27:27.210815','uyenp5114@gmail.com','Vũ Phương Uyên','OTHER',_binary '','$2a$10$b6RHXudo7ydhnQSBlkpXEOYOAWgyJ7RKbb0eHc0WSbyaWSVlDu4/u','0838624115','Patient'),(240005,'2026-10-26 14:29:36.177856','huynhbichtam2008@gmail.com','Bích Tâm Huỳnh',NULL,_binary '','{noop}GOOGLE_LOGIN',NULL,'Patient'),(240006,'2026-10-26 14:31:21.656130','tlpluong08@gmail.com','Trần lương phương anh','OTHER',_binary '','$2a$10$fx7k/5KCiHO96UEP2ZtYOu43xglajXGaZseTcDg6dziDy1JGxQD8G','0768570549','Patient'),(240007,'2026-10-26 14:48:42.052529','tranguyen5407@gmail.com','Trần Trang Uyên','OTHER',_binary '','$2a$10$QATBZFVPZHrHGddB7lmBu.OYeTsEIV1SDraC/UENW4lHQblEuXTGG','0704479358','Patient');
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `vouchers`
--

DROP TABLE IF EXISTS `vouchers`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `vouchers` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `code` varchar(255) NOT NULL,
  `discount_value` double DEFAULT NULL,
  `enable` bit(1) NOT NULL,
  `expiry_date` datetime(6) DEFAULT NULL,
  `name` varchar(255) DEFAULT NULL,
  `type` enum('DISCOUNT','SERVICE_TICKET') NOT NULL,
  PRIMARY KEY (`id`) /*T![clustered_index] CLUSTERED */,
  UNIQUE KEY `UK30ftp2biebbvpik8e49wlmady` (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin AUTO_INCREMENT=30001;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `vouchers`
--

LOCK TABLES `vouchers` WRITE;
/*!40000 ALTER TABLE `vouchers` DISABLE KEYS */;
INSERT INTO `vouchers` VALUES (1,'WOMANDAY2026',20,_binary '','2026-10-20 23:59:00.000000','Tri ân khách hàng nữ','DISCOUNT');
/*!40000 ALTER TABLE `vouchers` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-10-29 21:19:09
